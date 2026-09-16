import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { AGENT_TOOL_CATALOG } from '#layers/BaseAgent/server/agent/tool-catalog'
import { PREDEFINED_AGENTS } from '#layers/BaseAgent/server/agent/agents'
import { BUNDLED_SKILLS } from '#layers/BaseAgent/server/agent/skills'
import { agentRegistry } from '#layers/BaseAgent/server/agentic/agent-registry'
import { skillRegistry } from '#layers/BaseAgent/server/agentic/skill-registry'
import { skillRegistryService } from '#layers/BaseDB/server/services/skill-registry.service'

const CapabilitiesQuerySchema = z.object({
  businessId: z.string().min(1),
})

/**
 * Single discovery endpoint for the chat capability pickers: predefined
 * agents (each carrying its tool scope), the tool catalog, and skills split
 * into global bundled skills plus registered business/user skills — plus the
 * headless goal layer (goal skills and domain agents) that powers the goal
 * runner UI and the `execute_goal` chat tool. No prompts or orchestration
 * live here.
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
    agents: PREDEFINED_AGENTS.map(agent => ({
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
      agents: agentRegistry.list().map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        capabilities: agent.capabilities,
        skills: agent.skills,
      })),
    },
  }
})
