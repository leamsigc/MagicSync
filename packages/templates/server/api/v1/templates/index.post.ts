/**
 * POST /api/v1/templates - Create a new template
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { templateService } from "#layers/BaseDB/server/services/template.service"
import { TemplateType } from "#layers/BaseDB/db/schema"
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    // Get request body
    const body = await readBody(event)
    log.set({ templateType: body.type })

    // Validate required fields
    if (!body.type || !TemplateType.includes(body.type)) {
      log.error('Invalid or missing template type', { type: body.type })
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid or missing template type'
      })
    }

    if (!body.title || body.title.trim().length === 0) {
      log.error('Title is required', { title: body.title })
      throw createError({
        statusCode: 400,
        statusMessage: 'Title is required'
      })
    }

    if (!body.content || body.content.trim().length === 0) {
      log.error('Content is required', { contentLength: body.content?.trim().length })
      throw createError({
        statusCode: 400,
        statusMessage: 'Content is required'
      })
    }

    // Create template
    const businessId = typeof body.businessId === 'string' && body.businessId ? body.businessId : undefined
    let ownerId = user.id
    if (businessId) {
      const access = await requireBusinessAccess(event, user.id, businessId)
      if (!access.success || !access.data) {
        throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
      }
      ownerId = access.data.ownerUserId
    }

    const result = await templateService.create(user.id, {
      ownerId,
      businessId,
      type: body.type,
      title: body.title.trim(),
      content: body.content,
      isPublic: body.isPublic || false,
      assets: body.assets || []
    })

    if (!result.data) {
      log.error('Failed to create template', { error: result.error })
      throw createError({
        statusCode: 400,
        statusMessage: result.error || 'Failed to create template'
      })
    }

    log.info('Template created', { templateId: result.data?.id, type: body.type })
    return {
      success: true,
      data: result.data
    }
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string }
    if (err.statusCode) {
      throw error
    }

    log.error('Internal server error', { error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
