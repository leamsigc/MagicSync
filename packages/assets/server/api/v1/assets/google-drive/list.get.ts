
interface GoogleDriveFileItem {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  iconLink: string
  thumbnailLink?: string
  size?: string
  modifiedTime?: string
}

interface GoogleDriveListResponse {
  files: GoogleDriveFileItem[]
  nextPageToken?: string
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const query = getQuery(event)
    const searchQuery = (query.query as string) || ''
    const pageSize = parseInt(query.pageSize as string) || 15
    const pageToken = (query.pageToken as string) || ''

    const accessToken = await getGoogleDriveToken(user.id)
    if (!accessToken) {
      log.error('No Google Drive token found for user', { userId: user.id })
      throw createError({
        statusCode: 401,
        statusMessage: 'Google Drive not connected. Please connect your Google account first.',
      })
    }

    let driveQuery = `'root' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/' or mimeType='application/pdf')`
    if (searchQuery) {
      driveQuery = `name contains '${searchQuery.replace(/'/g, "\\'")}' and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/' or mimeType='application/pdf')`
    }

    const params: Record<string, string> = {
      q: driveQuery,
      pageSize: pageSize.toString(),
      fields: 'files(id,name,mimeType,webViewLink,iconLink,thumbnailLink,size,modifiedTime),nextPageToken',
      orderBy: 'modifiedTime desc',
    }
    if (pageToken) {
      params.pageToken = pageToken
    }

    const driveResponse = await $fetch<GoogleDriveListResponse>('https://www.googleapis.com/drive/v3/files', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      query: params,
    })

    log.info('Google Drive files listed', { count: driveResponse.files?.length || 0 })
    return {
      success: true,
      files: driveResponse.files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink,
        iconLink: file.iconLink,
        thumbnailLink: file.thumbnailLink,
        size: file.size,
        modifiedTime: file.modifiedTime,
      })),
      nextPageToken: driveResponse.nextPageToken,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    log.error('Google Drive list error', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to list Google Drive files',
    })
  }
})
