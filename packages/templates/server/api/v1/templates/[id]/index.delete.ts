/**
 * DELETE /api/v1/templates/[id] - Delete a template
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

    // Delete template (owner-only)
    const result = await templateService.delete(id, user.id)

    if (!result.data) {
      log.error('Failed to delete template', { code: result.code, error: result.error })
      throw createError({
        statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
        statusMessage: result.error || 'Failed to delete template'
      })
    }

    log.info('Template deleted successfully', { templateId: id })
    return {
      success: true,
      message: 'Template deleted successfully'
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
