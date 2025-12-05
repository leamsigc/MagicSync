/**
 * POST /api/v1/templates - Create a new template
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { templateService } from "#layers/BaseDB/server/services/template.service"
import { TemplateType } from "#layers/BaseDB/db/schema"

export default defineEventHandler(async (event) => {
    try {
        // Get user from session
        const user = await checkUserIsLogin(event)

        // Get request body
        const body = await readBody(event)

        // Validate required fields
        if (!body.type || !TemplateType.includes(body.type)) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid or missing template type'
            })
        }

        if (!body.title || body.title.trim().length === 0) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Title is required'
            })
        }

        if (!body.content || body.content.trim().length === 0) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Content is required'
            })
        }

        // Create template
        const result = await templateService.create(user.id, {
            ownerId: user.id,
            type: body.type,
            title: body.title.trim(),
            content: body.content,
            isPublic: body.isPublic || false,
            assets: body.assets || []
        })

        if (!result.success) {
            throw createError({
                statusCode: 400,
                statusMessage: result.error || 'Failed to create template'
            })
        }

        return {
            success: true,
            data: result.data
        }
    } catch (error: unknown) {
        const err = error as { statusCode?: number; message?: string }
        if (err.statusCode) {
            throw error
        }

        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error'
        })
    }
})
