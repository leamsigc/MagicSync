import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'

function maskConfig(config: { apiKey?: string | null } & Record<string, unknown>) {
  const { apiKey: _dropped, ...rest } = config
  return { ...rest, hasKey: Boolean(config.apiKey), apiKey: null }
}

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : null

  const effective = await userLlmConfigService.getEffectiveConfig(user.id, businessId)
  if (!effective.success || !effective.data) {
    throw createError({ statusCode: 500, statusMessage: effective.error ?? 'Failed to load effective config' })
  }

  const override = businessId ? await userLlmConfigService.getOverride(user.id, businessId) : null
  return {
    ...maskConfig(effective.data),
    source: override?.data ? 'override' : effective.data.id === 'default' ? 'system-default' : 'user-default',
  }
})
