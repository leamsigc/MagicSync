import { apiKeyService } from '#layers/BaseAuth/server/services/api-key.service'
import { businessOrgService } from '#layers/BaseAuth/server/services/business-org.service'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const { businessId } = getQuery(event) as { businessId?: string }
  log.set({ businessId })

  if (!businessId) {
    throw createError({ statusCode: 400, statusMessage: 'Business ID is required' })
  }

  const access = await requireBusinessAccess(event, user.id, businessId)
  if (!access.success || !access.data) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  const org = await businessOrgService.getOrgForBusiness(event, businessId)
  if (!org) {
    return { apiKeys: [], total: 0, role: access.data.role }
  }

  const apiKeys = await apiKeyService.listApiKeys(event, org.id, user.id)
  log.info({ content: 'Listed API keys', total: apiKeys.length, role: access.data.role })

  return { apiKeys, total: apiKeys.length, role: access.data.role }
})
