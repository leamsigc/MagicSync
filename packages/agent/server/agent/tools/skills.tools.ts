import { Type } from 'typebox'
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent'
import { skillRegistryService } from '#layers/BaseDB/server/services/skill-registry.service'
import { BUNDLED_SKILLS, findBundledSkill, loadBundledReference } from '../skills'
import type { AgentToolContext } from '../tool-context'

function toolResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }], details: {} }
}

function toolError(code: string | undefined, message: string): never {
  throw new Error(`${code ?? 'SKILLS_ERROR'}: ${message}`)
}

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

export function createSkillsTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'list_skills',
      label: 'List skills',
      description: 'List skills available to this session: bundled system skills plus skills registered for the business.',
      parameters: Type.Object({}),
      execute: async () => {
        const result = await skillRegistryService.listSkills(ctx.userId, ctx.businessId, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({
          skills: [...bundledSkillList(), ...registrySkillList(result.success ? result.data : [])],
        })
      },
    }),
    defineTool({
      name: 'load_skill',
      label: 'Load a skill',
      description: 'Load one skill: a bundled system skill (by name) or a registered business skill (by id or slug). Pass `file` to load a bundled reference document.',
      parameters: Type.Object({
        skillId: Type.Optional(Type.String({ description: 'Skill name, slug, or id' })),
        version: Type.Optional(Type.Number({ description: 'Specific registry version (default latest)' })),
        file: Type.Optional(Type.String({ description: 'Bundled reference file, e.g. references/evidence-rubric.md' })),
      }),
      execute: async (_toolCallId, params) => {
        const bundled = params.skillId ? findBundledSkill(params.skillId) : undefined
        if (bundled) {
          if (params.file) {
            const reference = loadBundledReference(bundled, params.file)
            if (!reference) toolError('NOT_FOUND', `Reference ${params.file} not found in bundled skill ${bundled.slug}`)
            return toolResult({ id: `bundled:${bundled.slug}`, name: bundled.name, file: params.file, content: reference })
          }
          return toolResult({
            id: `bundled:${bundled.slug}`,
            name: bundled.name,
            version: 1,
            source: 'bundled',
            content: bundled.body,
            references: Object.keys(bundled.references),
          })
        }

        const listed = await skillRegistryService.listSkills(ctx.userId, ctx.businessId, ctx.event)
        if (!listed.success) toolError(listed.code, listed.error)
        const skill = (listed.success ? listed.data : []).find(entry => entry.id === params.skillId || entry.slug === params.skillId)
        if (!skill) toolError('NOT_FOUND', `Skill ${params.skillId ?? ''} not found`)
        const resolved = await skillRegistryService.resolveSkillVersion(skill.id, params.version ?? null)
        if (!resolved.success) toolError(resolved.code, resolved.error)
        return toolResult({
          id: skill.id,
          name: skill.name,
          version: resolved.success ? resolved.data.version : null,
          source: 'registry',
          snapshot: resolved.success ? resolved.data.snapshot : null,
        })
      },
    }),
    defineTool({
      name: 'save_skill',
      label: 'Save a draft skill',
      description: 'Save a draft skill for human review. Drafts cannot run until published.',
      parameters: Type.Object({
        name: Type.String({ description: 'Skill name' }),
        description: Type.Optional(Type.String()),
        instructions: Type.String({ description: 'Skill instructions' }),
        allowedTools: Type.Optional(Type.Array(Type.String(), { description: 'Approved tool names' })),
      }),
      execute: async (_toolCallId, params) => {
        const result = await skillRegistryService.createSkill(ctx.userId, {
          businessId: ctx.businessId,
          ownerScope: 'business',
          name: params.name,
          slug: slugify(params.name),
          description: params.description ?? '',
          instructions: params.instructions,
          inputSchema: '{}',
          outputSchema: '{}',
          allowedTools: params.allowedTools ?? [],
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
