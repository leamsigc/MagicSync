import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import type { PostCreateBase } from "#layers/BaseDB/db/schema"
import { postService } from "#layers/BaseDB/server/services/post.service"

export default defineEventHandler(async (event) => {
    try {
        const user = await checkUserIsLogin(event)
        const body = await readBody(event)

        if (!Array.isArray(body.posts) || body.posts.length === 0) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid or empty posts array'
            })
        }

        const createdPosts = []
        const errors = []

        for (const post of body.posts) {
            if (!post.businessId || !post.content || !post.targetPlatforms) {
                errors.push({ post, error: 'Missing required fields' })
                continue
            }

            const postData: PostCreateBase = {
                businessId: post.businessId,
                content: post.content,
                mediaAssets: post.mediaAssets || [],
                targetPlatforms: post.targetPlatforms,
                scheduledAt: post.scheduledAt || new Date(),
                status: 'pending', // Bulk posts are always pending initiallly
                comment: [],
                platformContent: null,
                platformSettings: null,
                postFormat: 'post'
            }

            const result = await postService.create(user.id, postData)
            if (result.error) {
                errors.push({ post, error: result.error })
            } else {
                createdPosts.push(result.data)
            }
        }

        return {
            success: true,
            data: createdPosts,
            errors: errors.length > 0 ? errors : undefined
        }

    } catch (error: any) {
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.message || 'Internal server error'
        })
    }
})
