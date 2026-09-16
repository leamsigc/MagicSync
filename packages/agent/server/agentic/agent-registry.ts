import type { DomainAgentDefinition } from './contracts'
import { skillRegistry } from './skill-registry'
import './skills'

/**
 * Specialist domain agents. An agent is a named grouping of skills with
 * capability metadata — it owns domain specialization, never orchestration.
 * `tools` resolves lazily as the union of its skills' required tools.
 */
export const DOMAIN_AGENTS: DomainAgentDefinition[] = [
  {
    id: 'research',
    name: 'Research Agent',
    description: 'Business, competitor, market and trend research with cited evidence.',
    capabilities: ['business-research', 'competitor-research', 'market-research', 'trend-research'],
    requiredContext: ['business-profile'],
    skills: ['research-business', 'research-competitors'],
    outputKind: 'research_result',
    requiresHumanReview: false,
  },
  {
    id: 'business',
    name: 'Business Agent',
    description: 'Business analysis, opportunities, offers and local growth strategy.',
    capabilities: ['business-analysis', 'opportunity-discovery', 'business-strategy'],
    requiredContext: ['business-profile'],
    skills: ['research-business', 'analyze-business', 'discover-opportunities'],
    outputKind: 'research_result',
    requiresHumanReview: false,
  },
  {
    id: 'marketing',
    name: 'Marketing Agent',
    description: 'Campaigns, promotions, marketing plans and funnels.',
    capabilities: ['marketing-plans', 'campaigns', 'promotions'],
    requiredContext: ['business-profile', 'previous-research'],
    skills: ['create-marketing-plan', 'discover-opportunities'],
    outputKind: 'marketing_plan',
    requiresHumanReview: false,
  },
  {
    id: 'content',
    name: 'Content Agent',
    description: 'Research-grounded content ideas and platform-aware drafting.',
    capabilities: ['content-ideas', 'content-planning'],
    requiredContext: ['business-profile'],
    skills: ['create-content-ideas'],
    outputKind: 'content_ideas',
    requiresHumanReview: false,
  },
  {
    id: 'strategy',
    name: 'Strategy Agent',
    description: 'Prioritization, growth plans and next-best-action recommendations.',
    capabilities: ['prioritization', 'next-best-action', 'growth-plans'],
    requiredContext: ['previous-research'],
    skills: ['discover-opportunities', 'create-marketing-plan', 'identify-next-action'],
    outputKind: 'marketing_plan',
    requiresHumanReview: false,
  },
]

function toolsFor(agent: DomainAgentDefinition): string[] {
  return [...new Set(agent.skills.flatMap(skillId => skillRegistry.get(skillId)?.requiredTools ?? []))]
}

class AgentRegistryService {
  private agents = new Map<string, DomainAgentDefinition>(DOMAIN_AGENTS.map(agent => [agent.id, agent]))

  register(agent: DomainAgentDefinition): void {
    if (this.agents.has(agent.id)) throw new Error(`Agent already registered: ${agent.id}`)
    this.agents.set(agent.id, agent)
  }

  get(id: string): DomainAgentDefinition | undefined {
    return this.agents.get(id)
  }

  list(): DomainAgentDefinition[] {
    return [...this.agents.values()]
  }

  /** Agents whose skill set covers the given skill. */
  forSkill(skillId: string): DomainAgentDefinition[] {
    return this.list().filter(agent => agent.skills.includes(skillId))
  }

  toolAllowlist(id: string): string[] {
    const agent = this.agents.get(id)
    return agent ? toolsFor(agent) : []
  }
}

export const agentRegistry = new AgentRegistryService()
