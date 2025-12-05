/**
 * PUT /api/v1/templates/[id] - Update an existing template
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { templateService } from "#layers/BaseDB/server/services/template.service"

export default defineEventHandler(async (event) => {
    try {
        // Get user from session
        const user = await checkUserIsLogin(event)

        // Get template ID from route params
        const id = getRouterParam(event, 'id')

        if (!id) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Template ID is required'
            })
        }

        // Get request body
        const body = await readBody(event)

        // Prepare update data
        const updateData: Record<string, unknown> = {}

        if (body.title !== undefined) {
            if (body.title.trim().length === 0) {
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Title cannot be empty'
                })
            }
            updateData.title = body.title.trim()
        }

        if (body.content !== undefined) {
            if (body.content.trim().length === 0) {
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Content cannot be empty'
                })
            }
            updateData.content = body.content
        }

        if (body.isPublic !== undefined) {
            updateData.isPublic = Boolean(body.isPublic)
        }

        // Update template (owner-only)
        const result = await templateService.update(id, user.id, updateData)

        if (!result.success) {
            throw createError({
                statusCode: result.code === 'NOT_FOUND' ? 404 : 400,
                statusMessage: result.error || 'Failed to update template'
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
