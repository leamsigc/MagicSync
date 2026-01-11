import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bulkSchedulerService } from '../bulkScheduler.service'
import { postService } from '#layers/BaseDB/server/services/post.service'
import { notificationService } from '#layers/BaseAuth/server/services/notification.service'

vi.mock('#layers/BaseDB/server/services/post.service', () => ({
    postService: {
        create: vi.fn()
    }
}))

vi.mock('#layers/BaseAuth/server/services/notification.service', () => ({
    notificationService: {
        createNotification: vi.fn()
    }
}))

describe('BulkSchedulerService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('bulkCreateFromCsv', () => {
        it('should create posts and log success notification', async () => {
            const userId = 'user-1'
            const posts = [{ content: 'Post 1' }, { content: 'Post 2' }] as any
            const request = {
                posts,
                platforms: ['facebook'],
                businessId: 'biz-1'
            }

            vi.mocked(postService.create).mockResolvedValue({ data: { id: 'post-id' } } as any)

            const result = await bulkSchedulerService.bulkCreateFromCsv(userId, request)

            expect(result.success).toBe(true)
            expect(result.created).toBe(2)
            expect(notificationService.createNotification).toHaveBeenCalledWith(userId, expect.objectContaining({
                type: 'success',
                title: 'CSV Import Successful'
            }))
        })

        it('should handle partial failures and log warning notification', async () => {
            const userId = 'user-1'
            const posts = [{ content: 'Post 1' }, { content: 'Post 2' }] as any
            const request = {
                posts,
                platforms: ['facebook'],
                businessId: 'biz-1'
            }

            vi.mocked(postService.create)
                .mockResolvedValueOnce({ data: { id: 'post-id' } } as any)
                .mockResolvedValueOnce({ error: 'Failed to create' } as any)

            const result = await bulkSchedulerService.bulkCreateFromCsv(userId, request)

            expect(result.success).toBe(false)
            expect(result.created).toBe(1)
            expect(result.failed).toBe(1)
            expect(notificationService.createNotification).toHaveBeenCalledWith(userId, expect.objectContaining({
                type: 'warning',
                title: 'CSV Import Partial Success'
            }))
        })

        it('should log error notification on validation failure', async () => {
            const userId = 'user-1'
            const request = {
                posts: [{ content: '' }] as any, // Invalid content
                platforms: ['facebook'],
                businessId: 'biz-1'
            }

            const result = await bulkSchedulerService.bulkCreateFromCsv(userId, request)

            expect(result.success).toBe(false)
            expect(notificationService.createNotification).toHaveBeenCalledWith(userId, expect.objectContaining({
                type: 'error',
                title: 'CSV Import Failed'
            }))
        })
    })

    describe('bulkGenerate', () => {
        it('should generate posts and log success notification', async () => {
            const userId = 'user-1'
            const request = {
                templateContent: 'Post at {{date}}',
                variables: [],
                platforms: ['instagram'],
                businessId: 'biz-1',
                dateRange: {
                    startDate: new Date('2026-02-01'),
                    endDate: new Date('2026-02-02')
                },
                postsPerDay: 1
            }

            vi.mocked(postService.create).mockResolvedValue({ data: { id: 'post-id' } } as any)

            const result = await bulkSchedulerService.bulkGenerate(userId, request)

            expect(result.success).toBe(true)
            expect(notificationService.createNotification).toHaveBeenCalledWith(userId, expect.objectContaining({
                type: 'success',
                title: 'Bulk Generation Successful'
            }))
        })
    })
})
