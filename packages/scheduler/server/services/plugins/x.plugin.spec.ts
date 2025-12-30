import { describe, it, expect, vi, beforeEach } from 'vitest'
import { XPlugin } from './x.plugin'
import { SchedulerPost } from '../SchedulerPost.service'
import { TwitterApi } from 'twitter-api-v2'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'

vi.mock('twitter-api-v2')
vi.mock('#layers/BaseDB/server/services/social-media-account.service')
vi.mock('#layers/BaseDB/server/services/auditLog.service')

describe('XPlugin', () => {
    let scheduler: SchedulerPost
    let plugin: XPlugin

    beforeEach(() => {
        vi.clearAllMocks()
        scheduler = new SchedulerPost({})
        plugin = new XPlugin(scheduler)
    })

    describe('getAuthUrl', () => {
        it('should generate a valid OAuth 2.0 auth link', async () => {
            const mockGenerateOAuth2AuthLink = vi.fn().mockReturnValue({
                url: 'https://twitter.com/oauth',
                state: 'mock-state',
                codeVerifier: 'mock-verifier'
            })

            // @ts-ignore
            TwitterApi.mockImplementation(() => ({
                generateOAuth2AuthLink: mockGenerateOAuth2AuthLink
            }))

            const result = await plugin.getAuthUrl('business-123')

            expect(result).toEqual({
                url: 'https://twitter.com/oauth',
                state: 'mock-state',
                codeVerifier: 'mock-verifier'
            })
            expect(mockGenerateOAuth2AuthLink).toHaveBeenCalled()
        })
    })

    describe('handleCallback', () => {
        it('should exchange code for tokens and save account', async () => {
            const mockLoginWithOAuth2 = vi.fn().mockResolvedValue({
                accessToken: 'mock-access-token',
                refreshToken: 'mock-refresh-token',
                expiresIn: 7200
            })

            const mockMe = vi.fn().mockResolvedValue({
                data: {
                    id: '12345',
                    name: 'Test User',
                    username: 'testuser',
                    profile_image_url: 'https://image.com'
                }
            })

            // @ts-ignore
            TwitterApi.mockImplementation(() => ({
                loginWithOAuth2: mockLoginWithOAuth2,
                v2: {
                    me: mockMe
                }
            }))

            const mockUser = { id: 'user-123' }
            const queryParams = { code: 'mock-code', state: 'mock-state' }

            await plugin.handleCallback(queryParams, mockUser as any, 'mock-state', 'mock-verifier')

            expect(mockLoginWithOAuth2).toHaveBeenCalledWith({
                code: 'mock-code',
                codeVerifier: 'mock-verifier',
                redirectUri: expect.any(String)
            })
            expect(socialMediaAccountService.createOrUpdateAccountFromAuth).toHaveBeenCalled()
        })

        it('should throw error if state does not match', async () => {
            const mockUser = { id: 'user-123' }
            const queryParams = { code: 'mock-code', state: 'wrong-state' }

            await expect(plugin.handleCallback(queryParams, mockUser as any, 'correct-state', 'mock-verifier'))
                .rejects.toThrow('Invalid OAuth state or verifier')
        })
    })

    describe('ensureValidToken', () => {
        it('should refresh token if expired', async () => {
            const mockAccount = {
                platform: 'twitter',
                accessToken: 'expired-token',
                refreshToken: 'valid-refresh-token',
                tokenExpiresAt: new Date(Date.now() - 1000)
            }

            vi.mocked(socialMediaAccountService.isTokenExpired).mockReturnValue(true)

            const mockRefresh = vi.fn().mockResolvedValue({
                accessToken: 'new-token',
                refreshToken: 'new-refresh-token',
                expiresIn: 7200
            })

            // @ts-ignore
            TwitterApi.mockImplementation(() => ({
                refreshOAuth2Token: mockRefresh
            }))

            await plugin['ensureValidToken'](mockAccount as any)

            expect(mockRefresh).toHaveBeenCalledWith('valid-refresh-token')
            expect(socialMediaAccountService.refreshTokens).toHaveBeenCalled()
        })

        it('should not refresh if token is still valid', async () => {
            const mockAccount = {
                platform: 'twitter',
                accessToken: 'valid-token',
                tokenExpiresAt: new Date(Date.now() + 100000)
            }

            vi.mocked(socialMediaAccountService.isTokenExpired).mockReturnValue(false)

            await plugin['ensureValidToken'](mockAccount as any)

            expect(TwitterApi).not.toHaveBeenCalled()
        })
    })
})
