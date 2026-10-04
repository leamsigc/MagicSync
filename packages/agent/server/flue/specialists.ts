import { defineSubagent, defineTool, useSubagent, useTool, type ToolDefinition } from '@flue/runtime'
import { useFlueSkills } from './skills'
import * as v from 'valibot'
import { z } from 'zod'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { type AgentPromptName } from '../agent/prompts'
import { BUNDLED_SKILLS } from './skills'
import { CHAT_AGENT_MOUNT, createAgentToolBag, mountAgentTools } from '../agent/tools/mounts'
import { createAgentToolContext, type AgentComplete, type AgentToolContext } from '../agent/tool-context'
import { extractJsonObject } from '../utils/run-config'
import { delegationResultContract, guardDelegateTools } from './delegation'

/**
 * T06 first specialist subagents (PRD §7.1) — the SINGLE subagent set that
 * replaces `server/agent/agents.ts` (7 predefined) and
 * `server/agentic/agent-registry.ts` (5 domain agents), both deleted here.
 *
 * Each specialist is a focused Flue agent function returning a structured
 * result validated by its output contract. `MagicSyncAgent` composes them via
 * `useSubagent`; skills mount in T07, per-agent tool mounts tighten in T11.
 *
 * Transitional pi-runner facet: the legacy pi session builder (replaced in
 * T10) resolves chat profiles from `SPECIALIST_SESSION_PROFILES` below, which
 * reuse the existing prompts/tools/skills. `DEFAULT_SESSION_PROFILE` is the
 * old orchestrator profile moved verbatim; it leaves with the runner in T10.
 */

export type SpecialistId = 'business-agent' | 'research-agent' | 'strategy-agent' | 'content-agent'

export interface SpecialistOptions {
  /** Flue model specifier, e.g. 'stub/stub-model'. */
  model: string
  /** Brand Playbook context assembled for this run (may be empty). */
  systemContext?: string
  /** Tenant for grounded tools (business_lookup, agent tool bag); unmounted without it. */
  userId?: string
  businessId?: string
  /** Per-run model completion for the tools that call a model (T28). */
  complete?: AgentComplete
  /** Slice-executed skill tools, mounted per §7.1 ownership (T08). */
  skillTools?: Partial<Record<string, ToolDefinition>>
  /**
   * Server-owned tool bag keyed by tool name. Each delegate mounts only the
   * entries its `SpecialistSessionProfile.tools` allowlist names, guarded by
   * the T28 allowlist guard (`../agent/tools/mounts`) and the T27 turn budget /
   * carousel passthrough (`./delegation`). Must not repeat a tool already
   * mounted through `skillTools` — duplicate names in one render fail fast.
   *
   * Omit it and the real bag is built from the tenant above, so a delegate
   * mounts real tools rather than a test double; tests and T29 inject their own.
   */
  tools?: Partial<Record<string, ToolDefinition>>
}

const BusinessOutputSchema = z.object({
  business: z.object({ name: z.string(), industry: z.string().default('') }),
  offers: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  nextStep: z.string(),
})

const ResearchOutputSchema = z.object({
  summary: z.string(),
  findings: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
})

const StrategyOutputSchema = z.object({
  opportunities: z.array(z.object({ title: z.string(), rationale: z.string().default('') })).default([]),
  plan: z.array(z.string()).default([]),
  nextAction: z.string(),
})

const ContentOutputSchema = z.object({
  ideas: z.array(z.object({
    title: z.string(),
    brief: z.string().default(''),
    platforms: z.array(z.string()).default([]),
  })).default([]),
})

const OUTPUT_SCHEMAS = {
  'business-agent': BusinessOutputSchema,
  'research-agent': ResearchOutputSchema,
  'strategy-agent': StrategyOutputSchema,
  'content-agent': ContentOutputSchema,
} as const

/** Validate a specialist's structured reply (extracts embedded JSON first). */
export function parseSpecialistOutput(id: SpecialistId, text: string): Record<string, unknown> | null {
  const parsed = OUTPUT_SCHEMAS[id].safeParse(extractJsonObject(text))
  return parsed.success ? (parsed.data as Record<string, unknown>) : null
}

/** Skills each specialist mounts (T07 migrates these onto Flue skills). */
export const SPECIALIST_SKILLS: Record<SpecialistId, string[]> = {
  'business-agent': ['analyze-business', 'identify-next-action'],
  'research-agent': ['research-business', 'research-competitors'],
  'strategy-agent': ['discover-opportunities', 'create-marketing-plan'],
  'content-agent': ['create-content-ideas'],
}

/** Specialist ids whose skill set covers the given skill (orchestrator facet). */
export function specialistsForSkill(skillId: string): SpecialistId[] {
  return (Object.keys(SPECIALIST_SKILLS) as SpecialistId[]).filter(id => SPECIALIST_SKILLS[id].includes(skillId))
}

function contextBlock(systemContext: string): string {
  if (systemContext === '') return ''
  return `\n\nBusiness context:\n${systemContext}`
}

/** Skills a delegate mounts: its T06 goal skills plus the profile's forced skills. */
function delegateSkills(profile: SpecialistSessionProfile): string[] {
  const goalSkills = SPECIALIST_SKILLS[profile.name as SpecialistId] ?? []
  return [...new Set([...goalSkills, ...profile.forceSkills])]
}

/**
 * The real tool bag for this run, tenant closed over. Built lazily per
 * specialist render and only when a tenant is known, so a delegate without one
 * mounts nothing instead of an unscoped tool.
 */
function agentToolBag(options: SpecialistOptions): Record<string, ToolDefinition> {
  if (!options.userId || !options.businessId) return {}
  const ctx: AgentToolContext = createAgentToolContext({
    userId: options.userId,
    businessId: options.businessId,
    complete: options.complete,
  })
  return createAgentToolBag(ctx)
}

/**
 * Mount the profile's allowlisted tools, guarded twice: the T28 allowlist guard
 * (server-owned allowlist + audit, which does the mount filtering) and the T27
 * delegate guards (turn budget + carousel passthrough). The budget is created
 * per delegate render, so every task starts fresh.
 */
function mountProfileTools(profile: SpecialistSessionProfile, options: SpecialistOptions): void {
  const bag = options.tools ?? agentToolBag(options)
  const allowed = guardDelegateTools(mountAgentTools(Object.values(bag), {
    agent: profile.name,
    allowedTools: profile.tools,
  }))
  for (const tool of allowed) useTool(tool)
}

/** Deterministic business-profile read for BusinessAgent (tenant closed over). */
export function createBusinessLookupTool(input: { userId: string, businessId: string }) {
  return defineTool({
    name: 'business_lookup',
    description: 'Read the current business profile: name, category, description, website.',
    input: v.object({}),
    run: async () => {
      const found = await businessProfileService.findByIdOnly(input.businessId)
      if (!found.success) return { output: { found: false as const } }
      const profile = found.data
      return {
        output: {
          found: true as const,
          profile: {
            id: profile.id,
            name: profile.name,
            category: profile.category ?? '',
            description: profile.description ?? '',
            website: profile.website ?? '',
          },
        },
      }
    },
  })
}

function baseInstructions(role: string, task: string, shape: string, options: SpecialistOptions): string {
  return [
    role,
    task,
    'Never mention agents, skills, tools, models, or orchestration.',
    delegationResultContract(shape),
    contextBlock(options.systemContext ?? ''),
  ].filter(Boolean).join('\n\n')
}

/** Resolve the session profile that owns a specialist delegate. */
function specialistProfile(id: SpecialistId): SpecialistSessionProfile {
  const profile = SPECIALIST_SESSION_PROFILES.find(entry => entry.name === id)
  if (!profile) throw new Error(`SPECIALIST_PROFILE_MISSING: no session profile for ${id}`)
  return profile
}

export function createBusinessAgent(options: SpecialistOptions) {
  const profile = specialistProfile('business-agent')
  function BusinessAgent(): string {
    useFlueSkills(delegateSkills(profile))
    if (options.skillTools?.['analyze-business']) useTool(options.skillTools['analyze-business'])
    if (options.skillTools?.['identify-next-action']) useTool(options.skillTools['identify-next-action'])
    if (options.userId && options.businessId) {
      useTool(createBusinessLookupTool({ userId: options.userId, businessId: options.businessId }))
    }
    mountProfileTools(profile, options)
    return baseInstructions(
      'You analyze a business: profile, offers, and local growth opportunities.',
      'First call business_lookup when it is available, then analyze the profile and name concrete offers and opportunities.',
      '{"business": {"name": string, "industry": string}, "offers": string[], "opportunities": string[], "nextStep": string}',
      options,
    )
  }
  Object.defineProperty(BusinessAgent, 'name', { value: 'BusinessAgent' })
  return BusinessAgent
}

export function createResearchAgent(options: SpecialistOptions) {
  const profile = specialistProfile('research-agent')
  function ResearchAgent(): string {
    useFlueSkills(delegateSkills(profile))
    if (options.skillTools?.['research-business']) useTool(options.skillTools['research-business'])
    if (options.skillTools?.['research-competitors']) useTool(options.skillTools['research-competitors'])
    mountProfileTools(profile, options)
    return baseInstructions(
      'You research a business, its competitors, and its market from the business context you are given.',
      'Ground every finding in the provided context. Distinguish verified facts from inference and record what is missing.',
      '{"summary": string, "findings": string[], "sources": string[], "gaps": string[]}',
      options,
    )
  }
  Object.defineProperty(ResearchAgent, 'name', { value: 'ResearchAgent' })
  return ResearchAgent
}

export function createStrategyAgent(options: SpecialistOptions) {
  const profile = specialistProfile('strategy-agent')
  function StrategyAgent(): string {
    useFlueSkills(delegateSkills(profile))
    if (options.skillTools?.['discover-opportunities']) useTool(options.skillTools['discover-opportunities'])
    if (options.skillTools?.['create-marketing-plan']) useTool(options.skillTools['create-marketing-plan'])
    mountProfileTools(profile, options)
    return baseInstructions(
      'You turn opportunities into a short marketing plan with one clear next action.',
      'Prioritize ruthlessly: few opportunities, concrete plan steps, exactly one next action.',
      '{"opportunities": [{"title": string, "rationale": string}], "plan": string[], "nextAction": string}',
      options,
    )
  }
  Object.defineProperty(StrategyAgent, 'name', { value: 'StrategyAgent' })
  return StrategyAgent
}

export function createContentAgent(options: SpecialistOptions) {
  const profile = specialistProfile('content-agent')
  function ContentAgent(): string {
    useFlueSkills(delegateSkills(profile))
    if (options.skillTools?.['create-content-ideas']) useTool(options.skillTools['create-content-ideas'])
    mountProfileTools(profile, options)
    return baseInstructions(
      'You turn research into grounded content ideas and short drafts.',
      'Each idea carries a title, a one-line brief, and its target platforms.',
      '{"ideas": [{"title": string, "brief": string, "platforms": string[]}]}',
      options,
    )
  }
  Object.defineProperty(ContentAgent, 'name', { value: 'ContentAgent' })
  return ContentAgent
}

const SPECIALIST_FACTORIES = {
  'business-agent': createBusinessAgent,
  'research-agent': createResearchAgent,
  'strategy-agent': createStrategyAgent,
  'content-agent': createContentAgent,
} as const

const SPECIALIST_DESCRIPTIONS: Record<SpecialistId, string> = {
  'business-agent': 'Business profile analysis, offers, and local growth opportunities.',
  'research-agent': 'Business, competitor, and market research with cited evidence.',
  'strategy-agent': 'Opportunities prioritized into a marketing plan with one next action.',
  'content-agent': 'Research-grounded content ideas and platform-aware drafting.',
}

/**
 * The four subagent definitions MagicSyncAgent delegates to. Catalog name and
 * description come from `SPECIALIST_SESSION_PROFILES`, so the Flue `task`
 * roster and the pi session allowlist can never drift apart (T27).
 */
export function createSpecialistSubagents(options: SpecialistOptions) {
  return (Object.keys(SPECIALIST_FACTORIES) as SpecialistId[]).map((id) => {
    const profile = specialistProfile(id)
    return defineSubagent({
      name: profile.name,
      description: profile.description,
      agent: SPECIALIST_FACTORIES[id](options),
      model: options.model,
    })
  })
}

/** Mount the four specialists on a parent agent (MagicSyncAgent). */
export function useSpecialists(options: SpecialistOptions): void {
  for (const subagent of createSpecialistSubagents(options)) useSubagent(subagent)
}

export interface SpecialistSessionProfile {
  name: string
  description: string
  prompt: AgentPromptName
  tools: string[]
  skills: string[]
  forceSkills: string[]
  outputKind: string
  requiresHumanReview: boolean
}

/**
 * Pi-runner facet of the single set (transitional — the runner is replaced in
 * T10). Research and content keep their exact legacy profiles under new names;
 * business and strategy are constrained analyst profiles until Flue drives chat.
 *
 * T28 sizing: `tools` is now also the delegate's **Flue mount**, and a turn may
 * offer at most `MAX_TOOLS_PER_TURN` tools. Flue adds `task` and `activate_skill`
 * on top, so each delegate mounts at most four of ours — plus its goal skill
 * tools, which are counted in `tests/small-model.test.mjs`.
 */
export const SPECIALIST_SESSION_PROFILES: SpecialistSessionProfile[] = [
  {
    name: 'research-agent',
    description: SPECIALIST_DESCRIPTIONS['research-agent'],
    prompt: 'research',
    tools: ['web_search', 'scrape_url', 'retrieve'],
    skills: ['langsearch', 'social-research'],
    forceSkills: ['langsearch', 'social-research'],
    outputKind: 'research_result',
    requiresHumanReview: false,
  },
  {
    name: 'content-agent',
    description: SPECIALIST_DESCRIPTIONS['content-agent'],
    prompt: 'writePost',
    tools: ['write_post', 'retrieve', 'board_update'],
    skills: ['content-writer'],
    forceSkills: ['content-writer'],
    outputKind: 'social_post_draft',
    requiresHumanReview: false,
  },
  {
    name: 'business-agent',
    description: SPECIALIST_DESCRIPTIONS['business-agent'],
    prompt: 'research',
    tools: ['board_list'],
    skills: [],
    forceSkills: [],
    outputKind: 'research_result',
    requiresHumanReview: false,
  },
  {
    name: 'strategy-agent',
    description: SPECIALIST_DESCRIPTIONS['strategy-agent'],
    prompt: 'research',
    tools: ['board_list', 'board_add_cards'],
    skills: [],
    forceSkills: [],
    outputKind: 'research_result',
    requiresHumanReview: false,
  },
]

/**
 * Old orchestrator profile moved verbatim: the chat default until T10. T28
 * replaces its whole-catalog allowlist with `CHAT_AGENT_MOUNT`, the four tools
 * the orchestrator itself uses (it routes and delegates; the specialists and the
 * `/api/v1/content/*` capabilities own the rest).
 */
export const DEFAULT_SESSION_PROFILE: SpecialistSessionProfile = {
  name: 'magicsync-default',
  description: 'Chat orchestrator that operates the content board and delegates deep work to specialist agents.',
  prompt: 'orchestrator',
  tools: [...CHAT_AGENT_MOUNT],
  skills: BUNDLED_SKILLS.map(skill => skill.slug),
  forceSkills: ['content-ops'],
  outputKind: 'social_post_draft',
  requiresHumanReview: false,
}

export function findSpecialistProfile(name: string): SpecialistSessionProfile | undefined {
  return SPECIALIST_SESSION_PROFILES.find(profile => profile.name === name)
}

export function isSpecialistProfileName(name: string): boolean {
  return findSpecialistProfile(name) !== undefined
}

/** Goal-runner facet: capabilities per specialist for the goals section. */
export const SPECIALIST_CAPABILITIES: Record<SpecialistId, string[]> = {
  'business-agent': ['business-analysis', 'opportunity-discovery', 'business-strategy'],
  'research-agent': ['business-research', 'competitor-research', 'market-research', 'trend-research'],
  'strategy-agent': ['prioritization', 'next-best-action', 'growth-plans'],
  'content-agent': ['content-ideas', 'content-planning'],
}
