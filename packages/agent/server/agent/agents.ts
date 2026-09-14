import { AGENT_PROMPTS, type AgentPromptName } from './prompts'
import { BUNDLED_SKILLS } from './skills'
import { AGENT_TOOL_NAMES } from './tool-catalog'

/**
 * Predefined system agents. One registry powers chat delegation (subagent
 * tool), headless pipeline runs, and DB seeding, so a name always means the
 * same prompt/tools/skills everywhere.
 */
export interface PredefinedAgent {
  name: string
  description: string
  prompt: AgentPromptName
  tools: string[]
  skills: string[]
  /** Skills whose full instructions are force-loaded into the system prompt. */
  forceSkills: string[]
  /** Must be one of AGENT_OUTPUT_KINDS. */
  outputKind: string
  requiresHumanReview: boolean
}

export const PREDEFINED_AGENTS: PredefinedAgent[] = [
  {
    name: 'orchestrator',
    description: 'Chat orchestrator that operates the content board and delegates deep work to specialist agents.',
    prompt: 'orchestrator',
    tools: AGENT_TOOL_NAMES,
    skills: BUNDLED_SKILLS.map(skill => skill.slug),
    forceSkills: ['content-ops'],
    outputKind: 'social_post_draft',
    requiresHumanReview: false,
  },
  {
    name: 'researcher',
    description: 'Researches topics against primary sources and returns a cited evidence brief.',
    prompt: 'research',
    tools: ['web_search', 'scrape_url', 'retrieve', 'research_topic'],
    skills: ['langsearch', 'social-research'],
    forceSkills: ['langsearch', 'social-research'],
    outputKind: 'research_result',
    requiresHumanReview: false,
  },
  {
    name: 'writer',
    description: 'Writes grounded, platform-optimized social drafts from a completed research brief.',
    prompt: 'writePost',
    tools: ['write_post', 'retrieve', 'board_update'],
    skills: ['content-writer'],
    forceSkills: ['content-writer'],
    outputKind: 'social_post_draft',
    requiresHumanReview: false,
  },
  {
    name: 'humanizer',
    description: 'Rewrites drafts to sound human while preserving every claim.',
    prompt: 'humanize',
    tools: ['humanize'],
    skills: ['humanizer'],
    forceSkills: ['humanizer'],
    outputKind: 'humanized_social_post',
    requiresHumanReview: false,
  },
  {
    name: 'trend-scout',
    description: 'Finds current content angles grounded in analytics and live web signals.',
    prompt: 'trendScan',
    tools: ['scan_trends', 'web_search', 'board_add_cards', 'board_list'],
    skills: ['trend-scout'],
    forceSkills: ['trend-scout'],
    outputKind: 'research_result',
    requiresHumanReview: false,
  },
  {
    name: 'pii-guardian',
    description: 'Scans drafts and payloads for personal data and recommends redactions before publishing.',
    prompt: 'pii',
    tools: ['pii_scan'],
    skills: ['pii-guardian'],
    forceSkills: ['pii-guardian'],
    outputKind: 'approval_request',
    requiresHumanReview: true,
  },
]

/** Delegation targets exposed to the orchestrator (all but itself). */
export function delegatableAgents(): PredefinedAgent[] {
  return PREDEFINED_AGENTS.filter(agent => agent.name !== 'orchestrator')
}

export function findPredefinedAgent(name: string): PredefinedAgent | undefined {
  return PREDEFINED_AGENTS.find(agent => agent.name === name)
}
