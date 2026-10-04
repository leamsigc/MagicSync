import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { AGENT_TOOL_CATALOG } from '#layers/BaseAgent/server/agent/tool-catalog'
import { SPECIALIST_CAPABILITIES, SPECIALIST_SESSION_PROFILES, SPECIALIST_SKILLS, type SpecialistId } from '#layers/BaseAgent/server/flue/specialists'
import { BUNDLED_SKILLS } from '#layers/BaseAgent/server/flue/skills'
import { goalSkillRegistry as skillRegistry } from '#layers/BaseAgent/server/flue/skills'
import { skillRegistryService } from '#layers/BaseDB/server/services/skill-registry.service'

const CapabilitiesQuerySchema = z.object({
  businessId: z.string().min(1),
})

/**
 * Single discovery endpoint for the chat capability pickers: specialist
 * agents (each carrying its tool scope), the tool catalog, and skills split
 * into global bundled skills plus registered business/user skills — plus the
 * headless goal layer (goal skills and specialist agents) that powers the
 * goal runner UI and the `execute_goal` chat tool. No prompts or
 * orchestration live here.
 */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = CapabilitiesQuerySchema.parse(getQuery(event))

  const access = await requireBusinessAccess(event, user.id, query.businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  const registered = await skillRegistryService.listSkills(user.id, query.businessId, event)
  const skills = (registered.success ? registered.data : []).map(skill => ({
    id: skill.id,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    status: skill.status,
    scope: skill.ownerScope === 'business' ? 'business' as const : 'mine' as const,
  }))

  return {
    agents: SPECIALIST_SESSION_PROFILES.map(agent => ({
      name: agent.name,
      description: agent.description,
      tools: agent.tools,
    })),
    tools: AGENT_TOOL_CATALOG,
    skills: {
      bundled: BUNDLED_SKILLS.map(skill => ({
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        scope: 'global' as const,
      })),
      registered: skills,
    },
    goals: {
      skills: skillRegistry.catalog(),
      agents: SPECIALIST_SESSION_PROFILES.map(agent => {
        const id = agent.name as SpecialistId
        return {
          id,
          name: agent.name,
          description: agent.description,
          capabilities: SPECIALIST_CAPABILITIES[id],
          skills: SPECIALIST_SKILLS[id],
        }
      }),
    },
  }
})
