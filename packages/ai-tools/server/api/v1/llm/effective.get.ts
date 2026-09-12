import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

function sourceFor(hasOverride: boolean, configId: string): string {
  if (hasOverride) return 'override'
  return configId === 'default' ? 'system-default' : 'user-default'
}

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : null

  const effective = await aiToolsFacade.getEffectiveLlmConfig(user.id, businessId)
  if (effective.error || !effective.data) {
    throw createError({ statusCode: 500, statusMessage: effective.error || 'Failed to load effective config' })
  }

  const masked = aiToolsFacade.maskLlmConfig(effective.data)
  const override = businessId ? await aiToolsFacade.getLlmOverride(user.id, businessId) : null
  return { ...masked, source: sourceFor(!!override?.data, effective.data.id) }
})
