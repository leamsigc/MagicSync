import { getAccessTokenHelper } from '#layers/BaseAuth/server/utils/AuthHelpers'

export const getCanvaToken = async (userId: string): Promise<string | null> => {
  try {
    const tokenResult = await getAccessTokenHelper(
      new Headers(),
      {
        providerId: 'canva',
        userId,
      }
    )

    if (!tokenResult || !tokenResult.accessToken) {
      return null
    }

    return tokenResult.accessToken
  } catch (error) {
    log.error({ message: 'Failed to get Canva token', error: String(error) })
    return null
  }
}