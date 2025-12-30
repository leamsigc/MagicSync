import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InstagramPlugin } from './instagram.plugin'
import { SchedulerPost } from '../SchedulerPost.service'

vi.mock('#layers/BaseDB/server/services/auditLog.service')

describe('InstagramPlugin', () => {
    let scheduler: SchedulerPost
    let plugin: InstagramPlugin

    beforeEach(() => {
        vi.clearAllMocks()
        scheduler = new SchedulerPost({})
        plugin = new InstagramPlugin(scheduler)
        // Mock global fetch
        global.fetch = vi.fn()
    })

    describe('waitForMediaReady', () => {
        it('should wait until status_code is FINISHED', async () => {
            const mockFetch = vi.mocked(global.fetch)

            // First call returns IN_PROGRESS, second returns FINISHED
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ status_code: 'IN_PROGRESS' })
                } as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ status_code: 'FINISHED' })
                } as any)

            // Mock delay to speed up tests
            // @ts-ignore
            vi.spyOn(global, 'setTimeout').mockImplementation(cb => cb())

            await plugin['waitForMediaReady']('container-123', 'token-abc')

            expect(mockFetch).toHaveBeenCalledTimes(2)
            expect(mockFetch).toHaveBeenLastCalledWith(
                expect.stringContaining('container-123'),
                expect.any(Object)
            )
        })

        it('should throw error if status_code is ERROR', async () => {
            const mockFetch = vi.mocked(global.fetch)
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ status_code: 'ERROR' })
            } as any)

            await expect(plugin['waitForMediaReady']('container-123', 'token-abc'))
                .rejects.toThrow('Media container container-123 failed to process')
        })

        it('should timeout after max attempts', async () => {
            const mockFetch = vi.mocked(global.fetch)
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ status_code: 'IN_PROGRESS' })
            } as any)

            // @ts-ignore
            vi.spyOn(global, 'setTimeout').mockImplementation(cb => cb())

            await expect(plugin['waitForMediaReady']('container-123', 'token-abc', 2))
                .rejects.toThrow('Media container container-123 processing timed out')
        })
    })

    describe('post', () => {
        it('should create container and wait for readiness before publishing', async () => {
            const mockFetch = vi.mocked(global.fetch)

            // 1. Create container
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 'container-123' })
            } as any)

            // 2. Poll for readiness (waitForMediaReady)
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ status_code: 'FINISHED' })
            } as any)

            // 3. Publish container
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 'post-123' })
            } as any)

            const mockPostDetails = {
                content: 'Test post',
                assets: [{ url: 'https://image.com', mimeType: 'image/jpeg' }]
            }
            const mockAccount = { accountId: 'account-123', accessToken: 'token-abc' }

            const result = await plugin.post(mockPostDetails as any, [], mockAccount as any)

            expect(result.status).toBe('published')
            expect(result.postId).toBe('post-123')
            expect(mockFetch).toHaveBeenCalledTimes(3)
        })
    })
})
