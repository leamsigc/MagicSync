import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import {
  agentRegistryService,
  type BuiltinAgent,
  type BuiltinSkill,
} from '#layers/BaseDB/server/services/agent-registry.service'
import { AGENT_PROMPTS } from '#layers/BaseAgent/server/agent/prompts'
import { SPECIALIST_SESSION_PROFILES } from '#layers/BaseAgent/server/flue/specialists'
import { BUNDLED_SKILLS } from '#layers/BaseAgent/server/flue/skills'

// The agent layer owns the runtime registry (prompts + skills + tools); this
// route mirrors it into the per-business DB registry for the UI and audit.
function builtinAgents(): BuiltinAgent[] {
  return SPECIALIST_SESSION_PROFILES.map(agent => ({
    name: agent.name,
    description: agent.description,
    systemPrompt: AGENT_PROMPTS[agent.prompt],
    skills: agent.skills,
    tools: agent.tools,
    outputKind: agent.outputKind,
    requiresHumanReview: agent.requiresHumanReview,
  }))
}

function builtinSkills(): BuiltinSkill[] {
  return BUNDLED_SKILLS.map(skill => ({
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    instructions: skill.body,
    tools: skill.tools,
  }))
}

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)
  const businessId = typeof body?.businessId === 'string' ? body.businessId : null
  if (!businessId) throw createError({ statusCode: 400, message: 'businessId is required' })
  const result = await agentRegistryService.ensureBuiltins(user.id, businessId, user.email || user.id, event, {
    agents: builtinAgents(),
    skills: builtinSkills(),
  })
  if (!result.success) {
    throw createError({ statusCode: result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400, message: result.error })
  }
  return result
})
