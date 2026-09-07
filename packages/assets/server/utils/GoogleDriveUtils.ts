import { getAccessTokenHelper } from '#layers/BaseAuth/server/utils/AuthHelpers'

const getTokenForProvider = async (providerId: string, userId: string): Promise<string | null> => {
  const tokenResult = await getAccessTokenHelper(
    new Headers(),
    {
      providerId,
      userId,
    }
  )

  if (!tokenResult || !tokenResult.accessToken) {
    return null
  }

  return tokenResult.accessToken
}

export const getGoogleDriveToken = async (userId: string): Promise<string | null> => {
  try {
    // Dedicated Drive consent (drive.readonly only — Google rejects Drive
    // scopes mixed with YouTube scopes in one request).
    const driveToken = await getTokenForProvider('google-drive', userId)
    if (driveToken) {
      return driveToken
    }

    // Legacy fallback: tokens granted via the `google` provider before the
    // Drive scopes were split out still carry drive.readonly.
    return await getTokenForProvider('google', userId)
  } catch (error) {
    console.error('Failed to get Google Drive token:', error)
    return null
  }
}