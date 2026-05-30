/**
 * GET /api/v1/templates/[id] - Get a single template by ID
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { templateService } from "#layers/BaseDB/server/services/template.service"

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    // Get template ID from route params
    const id = getRouterParam(event, 'id')
    log.set({ templateId: id })

    if (!id) {
      log.error('Template ID is required', {})
      throw createError({
        statusCode: 400,
        statusMessage: 'Template ID is required'
      })
    }

    // Get template (owner-scoped or public)
    const result = await templateService.findById(id, user.id)

    if (!result.success) {
      log.error('Template not found', { code: result.code, error: result.error })
      throw createError({
        statusCode: 404,
        statusMessage: result.error || 'Template not found'
      })
    }

    log.info('Template fetched successfully', { templateId: id })
    return {
      success: true,
      data: result.data
    }
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string }
    if (err.statusCode) {
      throw error
    }

    log.error('Internal server error', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
