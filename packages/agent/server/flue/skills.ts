import { defineSkill, useSkill, type SkillDefinition } from '@flue/runtime'
import type { ExecutableSkill } from '../agentic/contracts'
import { researchBusinessSkill } from '../agentic/skills/research-business'
import { researchCompetitorsSkill } from '../agentic/skills/research-competitors'
import { analyzeBusinessSkill } from '../agentic/skills/analyze-business'
import { discoverOpportunitiesSkill } from '../agentic/skills/discover-opportunities'
import { createMarketingPlanSkill } from '../agentic/skills/create-marketing-plan'
import { identifyNextActionSkill } from '../agentic/skills/identify-next-action'
import { createContentIdeasSkill } from '../agentic/skills/create-content-ideas'
import langsearchBody from '../agent/skills/langsearch/SKILL.md?raw'
import socialResearchBody from '../agent/skills/social-research/SKILL.md?raw'
import contentWriterBody from '../agent/skills/content-writer/SKILL.md?raw'
import humanizerBody from '../agent/skills/humanizer/SKILL.md?raw'
import trendScoutBody from '../agent/skills/trend-scout/SKILL.md?raw'
import contentOpsBody from '../agent/skills/content-ops/SKILL.md?raw'
import carouselBody from '../agent/skills/carousel/SKILL.md?raw'
import contentScoreBody from '../agent/skills/content-score/SKILL.md?raw'
import evidenceRubric from '../agent/skills/social-research/references/evidence-rubric.md?raw'
import scoringRubric from '../agent/skills/content-score/references/scoring-rubric.md?raw'
import researchBusinessBody from '../agentic/skills/research-business/SKILL.md?raw'
import researchCompetitorsBody from '../agentic/skills/research-competitors/SKILL.md?raw'
import analyzeBusinessBody from '../agentic/skills/analyze-business/SKILL.md?raw'
import discoverOpportunitiesBody from '../agentic/skills/discover-opportunities/SKILL.md?raw'
import createMarketingPlanBody from '../agentic/skills/create-marketing-plan/SKILL.md?raw'
import identifyNextActionBody from '../agentic/skills/identify-next-action/SKILL.md?raw'
import createContentIdeasBody from '../agentic/skills/create-content-ideas/SKILL.md?raw'

/**
 * T07 single skill system (PRD §7.2) — the ONE Flue skill set replacing
 * `server/agent/skills/index.ts` (pi bundled skills) and
 * `server/agentic/{skill-registry,index}.ts` (goal registry), both deleted
 * here. Every skill keeps its id and its `SKILL.md` instruction body; goal
 * skills keep their input/output contracts as the verification step.
 *
 * Two transitional facets serve the legacy pi runtime until T10:
 * - `BUNDLED_SKILLS` + helpers: same shape as before, sourced here, for the
 *   runner, `load_skill` tool, chat pickers, and DB seeding.
 * - `goalSkillRegistry`: same `get`/`has`/`list`/`catalog` surface the goal
 *   orchestrator and planner consume, backed by the skill implementations.
 */

export interface SkillFileMeta {
  name: string
  description: string
}

/** Parse the YAML-ish frontmatter subset of the repo's SKILL.md files. */
export function parseSkillMeta(body: string): SkillFileMeta | null {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const fields: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator > 0) fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }
  return fields.name && fields.description
    ? { name: fields.name, description: fields.description }
    : null
}

/**
 * Validate Agent Skills frontmatter (open Agent Skills format: `name` +
 * `description` required). Throws on violation — bad definitions fail at
 * module load instead of first render.
 */
export function validateSkillFrontmatter(id: string, body: string): SkillFileMeta {
  const meta = parseSkillMeta(body)
  if (!meta) throw new Error(`Skill ${id} has invalid frontmatter: name + description are required`)
  return meta
}

export interface FlueSkillEntry {
  id: string
  kind: 'goal' | 'chat'
  definition: SkillDefinition
  /** Pi-runner facet: tool scope for prompt blocks and allowlists. */
  tools: string[]
  /** Pi-runner facet: progressive-disclosure reference files. */
  references: Record<string, string>
  /** Goal facet: the executable implementation (run/verify/contracts). */
  executable?: ExecutableSkill
}

interface SkillSpec {
  id: string
  kind: 'goal' | 'chat'
  body: string
  tools: string[]
  references?: Record<string, string>
  executable?: ExecutableSkill
}

const CHAT_REFERENCE_FILES: Record<string, Record<string, string>> = {
  'social-research': { 'references/evidence-rubric.md': evidenceRubric },
  // The rubric is a separate file on purpose: it is the authority for every
  // point value and band, so the owner can retune scoring by editing one
  // document instead of reading TypeScript.
  'content-score': { 'references/scoring-rubric.md': scoringRubric },
}

const SKILL_SPECS: SkillSpec[] = [
  { id: 'research-business', kind: 'goal', body: researchBusinessBody, tools: [], executable: researchBusinessSkill },
  { id: 'research-competitors', kind: 'goal', body: researchCompetitorsBody, tools: [], executable: researchCompetitorsSkill },
  { id: 'analyze-business', kind: 'goal', body: analyzeBusinessBody, tools: [], executable: analyzeBusinessSkill },
  { id: 'discover-opportunities', kind: 'goal', body: discoverOpportunitiesBody, tools: [], executable: discoverOpportunitiesSkill },
  { id: 'create-marketing-plan', kind: 'goal', body: createMarketingPlanBody, tools: [], executable: createMarketingPlanSkill },
  { id: 'identify-next-action', kind: 'goal', body: identifyNextActionBody, tools: [], executable: identifyNextActionSkill },
  { id: 'create-content-ideas', kind: 'goal', body: createContentIdeasBody, tools: [], executable: createContentIdeasSkill },
  { id: 'langsearch', kind: 'chat', body: langsearchBody, tools: ['web_search'] },
  { id: 'social-research', kind: 'chat', body: socialResearchBody, tools: ['web_search', 'scrape_url', 'retrieve'] },
  { id: 'content-writer', kind: 'chat', body: contentWriterBody, tools: ['write_post', 'apply_template', 'retrieve'] },
  { id: 'humanizer', kind: 'chat', body: humanizerBody, tools: ['humanize'] },
  { id: 'trend-scout', kind: 'chat', body: trendScoutBody, tools: ['scan_trends', 'web_search', 'board_add_cards'] },
  { id: 'content-ops', kind: 'chat', body: contentOpsBody, tools: ['subagent', 'board_list', 'board_move', 'board_add_cards'] },
  { id: 'carousel', kind: 'chat', body: carouselBody, tools: ['retrieve', 'generate_carousel', 'revise_carousel'] },
  { id: 'content-score', kind: 'chat', body: contentScoreBody, tools: [] },
]

function buildEntry(spec: SkillSpec): FlueSkillEntry {
  const meta = validateSkillFrontmatter(spec.id, spec.body)
  const references = { ...(CHAT_REFERENCE_FILES[spec.id] ?? {}), ...(spec.references ?? {}) }
  return {
    id: spec.id,
    kind: spec.kind,
    definition: defineSkill({
      name: meta.name,
      description: meta.description,
      instructions: spec.body,
      allowedTools: spec.tools.join(' '),
    }),
    tools: spec.tools,
    references,
    executable: spec.executable,
  }
}

export const FLUE_SKILLS: FlueSkillEntry[] = SKILL_SPECS.map(buildEntry)

export function getFlueSkill(id: string): FlueSkillEntry | undefined {
  return FLUE_SKILLS.find(entry => entry.id === id)
}

/** Mount Flue skills on an agent by id (specialists use this). */
export function useFlueSkills(ids: string[]): void {
  for (const id of ids) {
    const entry = getFlueSkill(id)
    if (entry) useSkill(entry.definition)
  }
}

/** Goal facet: the executable seven with contracts, for orchestrator/planner. */
export function goalSkills(): ExecutableSkill[] {
  return FLUE_SKILLS.filter((entry): entry is FlueSkillEntry & { executable: ExecutableSkill } => entry.executable !== undefined)
    .map(entry => entry.executable)
}

class GoalSkillRegistry {
  private overlay = new Map<string, ExecutableSkill>()

  get(id: string): ExecutableSkill | undefined {
    return this.overlay.get(id) ?? getFlueSkill(id)?.executable
  }

  has(id: string): boolean {
    return this.get(id) !== undefined
  }

  list(): ExecutableSkill[] {
    const ids = new Set(this.overlay.keys())
    return [...this.overlay.values(), ...goalSkills().filter(skill => !ids.has(skill.id))]
  }

  catalog(): Array<{ id: string, description: string }> {
    return this.list().map(skill => ({ id: skill.id, description: skill.description }))
  }

  /** Test/fixture seam: inject an executable skill (duplicate ids throw). */
  register(skill: ExecutableSkill): void {
    if (this.has(skill.id)) throw new Error(`Skill already registered: ${skill.id}`)
    this.overlay.set(skill.id, skill)
  }

  unregister(id: string): void {
    this.overlay.delete(id)
  }
}

export const goalSkillRegistry = new GoalSkillRegistry()

export interface BundledSkill {
  slug: string
  name: string
  description: string
  tools: string[]
  /** Full SKILL.md (frontmatter + instructions) returned by load_skill. */
  body: string
  /** Progressive-disclosure files loadable by name through load_skill. */
  references: Record<string, string>
}

/** Pi-runner facet: chat skills in the legacy bundled shape (unchanged content). */
export const BUNDLED_SKILLS: BundledSkill[] = FLUE_SKILLS
  .filter(entry => entry.kind === 'chat')
  .map(entry => {
    const meta = parseSkillMeta(entry.definition.instructions) ?? { name: entry.id, description: '' }
    return { slug: entry.id, name: meta.name, description: meta.description, tools: entry.tools, body: entry.definition.instructions, references: entry.references }
  })

export function findBundledSkill(id: string): BundledSkill | undefined {
  return BUNDLED_SKILLS.find(skill => skill.slug === id || skill.name === id)
}

/** Skills selected by slug or name, in registry order. */
export function selectBundledSkills(ids: string[]): BundledSkill[] {
  const wanted = new Set(ids)
  return BUNDLED_SKILLS.filter(skill => wanted.has(skill.slug) || wanted.has(skill.name))
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * pi only lists skills when a file-reading tool exists; our sessions have none,
 * so the runtime injects this block itself and `load_skill` serves the bodies.
 */
export function formatBundledSkillsForPrompt(skills: BundledSkill[]): string {
  if (skills.length === 0) return ''
  const lines = [
    'The following skills provide specialized instructions for specific tasks.',
    'Use the `load_skill` tool with a skill name to load its full instructions when a task matches its description.',
    '',
    '<available_skills>',
  ]
  for (const skill of skills) {
    lines.push('  <skill>')
    lines.push(`    <name>${escapeXml(skill.name)}</name>`)
    lines.push(`    <description>${escapeXml(skill.description)}</description>`)
    lines.push(`    <tools>${escapeXml(skill.tools.join(', '))}</tools>`)
    lines.push('  </skill>')
  }
  lines.push('</available_skills>')
  return lines.join('\n')
}

/** Resolve a reference file path (`./references/x.md` and `references/x.md` both work). */
export function loadBundledReference(skill: BundledSkill, file: string): string | null {
  const normalized = file.replace(/^\.\//, '')
  return skill.references[normalized] ?? null
}
