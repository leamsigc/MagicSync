import { getAccessTokenHelper } from '#layers/BaseAuth/server/utils/AuthHelpers'

export const getGoogleDriveToken = async (userId: string): Promise<string | null> => {
  try {
    const tokenResult = await getAccessTokenHelper(
      new Headers(),
      {
        providerId: 'google',
        userId,
      }
    )

    if (!tokenResult || !tokenResult.accessToken) {
      return null
    }

    return tokenResult.accessToken
  } catch (error) {
    console.error('Failed to get Google Drive token:', error)
    return null
  }
}