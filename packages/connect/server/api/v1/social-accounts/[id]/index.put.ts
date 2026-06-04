import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { z } from 'zod'

const UpdateConnectionSettingsSchema = z.object({
  businessId: z.string().optional(),
  managerIds: z.array(z.string()).optional(),
})

defineRouteMeta({
  openAPI: {
    tags: ['Connection'],
    operationId: 'updateSocialMediaAccountSettings',
    summary: 'Update Social Media Account Settings',
    description: 'Update connection settings including business and managers',
  },
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)

  try {
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const accountId = getRouterParam(event, 'id')

    if (!accountId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Account ID is required',
      })
    }

    log.set({ accountId })

    const body = await readBody(event)
    const parsed = UpdateConnectionSettingsSchema.safeParse(body)

    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request body',
        data: parsed.error.issues,
      })
    }

    const result = await socialMediaAccountService.updateConnectionSettings(
      accountId,
      user.id,
      parsed.data
    )

    if (!result.success) {
      throw createError({
        statusCode: 400,
        statusMessage: result.error || 'Failed to update connection settings',
      })
    }

    log.info({ message: 'Connection settings updated', accountId })

    return { success: true, message: 'Connection settings updated successfully' }
  } catch (error) {
    log.error({ message: 'Failed to update connection settings', error })

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update connection settings',
    })
  }
})
