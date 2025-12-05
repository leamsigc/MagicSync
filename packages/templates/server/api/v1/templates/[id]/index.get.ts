/**
 * GET /api/v1/templates/[id] - Get a single template by ID
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

        // Get template (owner-scoped or public)
        const result = await templateService.findById(id, user.id)

        if (!result.success) {
            throw createError({
                statusCode: 404,
                statusMessage: result.error || 'Template not found'
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
