/**
 * GET /api/v1/templates - List templates for authenticated user
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

        // Get query parameters
        const query = getQuery(event)

        // Parse pagination parameters
        const page = parseInt(query.page as string) || 1
        const limit = parseInt(query.limit as string) || 20

        // Parse filter parameters
        const filters: Record<string, unknown> = {}
        if (query.type && TemplateType.includes(query.type as typeof TemplateType[number])) {
            filters.type = query.type as string
        }
        if (query.isPublic !== undefined) {
            filters.isPublic = query.isPublic === 'true'
        }

        // Get templates for owner
        const result = await templateService.findByOwner(user.id, {
            pagination: { page, limit },
            filters
        })

        return result
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
