import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { skillRegistryService } from '#layers/BaseDB/server/services/skill-registry.service'
import { BUNDLED_SKILLS, findBundledSkill, loadBundledReference } from '../../flue/skills'
import type { AgentToolContext } from '../tool-context'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'SKILLS_ERROR')

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
}

function bundledSkillList() {
  return BUNDLED_SKILLS.map(skill => ({
    id: `bundled:${skill.slug}`,
    name: skill.name,
    slug: skill.slug,
    description: skill.description,
    status: 'active' as const,
    version: 1,
    source: 'bundled' as const,
    tools: skill.tools,
    references: Object.keys(skill.references),
  }))
}

function registrySkillList(rows: Array<{
  id: string
  name: string
  slug: string
  description: string
  status: string
  version: number
}>) {
  return rows.map(skill => ({
    id: skill.id,
    name: skill.name,
    slug: skill.slug,
    description: skill.description,
    status: skill.status,
    version: skill.version,
    source: 'registry' as const,
    tools: [],
    references: [],
  }))
}

/** Bundled body or one bundled reference file (T07 progressive disclosure). */
function bundledSkillResult(skillId: string, file: string | undefined) {
  const bundled = findBundledSkill(skillId)
  if (!bundled) return null
  if (!file) {
    return toolResult({
      id: `bundled:${bundled.slug}`,
      name: bundled.name,
      version: 1,
      source: 'bundled',
      content: bundled.body,
      references: Object.keys(bundled.references),
    })
  }
  const reference = loadBundledReference(bundled, file)
  if (!reference) toolError('NOT_FOUND', `Reference ${file} not found in bundled skill ${bundled.slug}`)
  return toolResult({ id: `bundled:${bundled.slug}`, name: bundled.name, file, content: reference })
}

/** Registry facet: a business-registered skill at a pinned version. */
async function registrySkillResult(ctx: AgentToolContext, skillId: string | undefined, version: number | undefined) {
  const listed = await skillRegistryService.listSkills(ctx.userId, ctx.businessId, ctx.event)
  if (!listed.success) toolError(listed.code, listed.error)
  const skill = (listed.success ? listed.data : []).find(entry => entry.id === skillId || entry.slug === skillId)
  if (!skill) toolError('NOT_FOUND', `Skill ${skillId ?? ''} not found`)
  const resolved = await skillRegistryService.resolveSkillVersion(skill.id, version ?? null)
  if (!resolved.success) toolError(resolved.code, resolved.error)
  return toolResult({
    id: skill.id,
    name: skill.name,
    version: resolved.success ? resolved.data.version : null,
    source: 'registry',
    snapshot: resolved.success ? resolved.data.snapshot : null,
  })
}

export function createSkillsTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'list_skills',
      description: 'List skills available to this session: bundled system skills plus skills registered for the business.',
      input: v.object({}),
      run: async () => {
        const result = await skillRegistryService.listSkills(ctx.userId, ctx.businessId, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({
          skills: [...bundledSkillList(), ...registrySkillList(result.success ? result.data : [])],
        })
      },
    }),
    defineTool({
      name: 'load_skill',
      description: 'Load one skill: a bundled system skill (by name) or a registered business skill (by id or slug). Pass `file` to load a bundled reference document.',
      input: v.object({
        skillId: v.optional(v.pipe(v.string(), v.description('Skill name, slug, or id'))),
        version: v.optional(v.pipe(v.number(), v.description('Specific registry version (default latest)'))),
        file: v.optional(v.pipe(v.string(), v.description('Bundled reference file, e.g. references/evidence-rubric.md'))),
      }),
      run: async (toolCtx) => {
        const { skillId, version, file } = toolCtx.data
        if (skillId) {
          const bundled = bundledSkillResult(skillId, file)
          if (bundled) return bundled
        }
        return registrySkillResult(ctx, skillId, version)
      },
    }),
    defineTool({
      name: 'save_skill',
      description: 'Save a draft skill for human review. Drafts cannot run until published.',
      input: v.object({
        name: v.pipe(v.string(), v.description('Skill name')),
        description: v.optional(v.string()),
        instructions: v.pipe(v.string(), v.description('Skill instructions')),
        allowedTools: v.optional(v.array(v.pipe(v.string(), v.description('Approved tool names')))),
      }),
      run: async (toolCtx) => {
        const { name, description, instructions, allowedTools } = toolCtx.data
        const result = await skillRegistryService.createSkill(ctx.userId, {
          businessId: ctx.businessId,
          ownerScope: 'business',
          name,
          slug: slugify(name),
          description: description ?? '',
          instructions,
          inputSchema: '{}',
          outputSchema: '{}',
          allowedTools: allowedTools ?? [],
          sourceType: 'authored',
          sourceUri: null,
        }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({
          skill: result.success
            ? { id: result.data.id, name: result.data.name, slug: result.data.slug, status: result.data.status, version: result.data.version }
            : null,
        })
      },
    }),
  ]
}
