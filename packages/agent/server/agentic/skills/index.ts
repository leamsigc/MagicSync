import { skillRegistry } from '../skill-registry'
import { researchBusinessSkill } from './research-business'
import { researchCompetitorsSkill } from './research-competitors'
import { analyzeBusinessSkill } from './analyze-business'
import { discoverOpportunitiesSkill } from './discover-opportunities'
import { createContentIdeasSkill } from './create-content-ideas'
import { createMarketingPlanSkill } from './create-marketing-plan'
import { identifyNextActionSkill } from './identify-next-action'

/** Builtin goal skills; importing this module registers them. */
export const BUILTIN_GOAL_SKILLS = [
  researchBusinessSkill,
  researchCompetitorsSkill,
  analyzeBusinessSkill,
  discoverOpportunitiesSkill,
  createContentIdeasSkill,
  createMarketingPlanSkill,
  identifyNextActionSkill,
]

export function registerBuiltinGoalSkills(): void {
  for (const skill of BUILTIN_GOAL_SKILLS) {
    if (!skillRegistry.has(skill.id)) skillRegistry.register(skill)
  }
}

registerBuiltinGoalSkills()
