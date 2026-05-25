

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

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const { files } = await readBody<{ files: GoogleDriveFileItem[] }>(event)
    log.set({ filesCount: files?.length || 0 })

    if (!files || files.length === 0) {
      log.error('No files provided for download', {})
      throw createError({
        statusCode: 400,
        statusMessage: 'No files provided for download.',
      })
    }

    const accessToken = await getGoogleDriveToken(user.id)
    if (!accessToken) {
      log.error('No Google Drive token found for user', { userId: user.id })
      throw createError({
        statusCode: 401,
        statusMessage: 'Google Drive not connected. Please connect your Google account first.',
      })
    }

    const uploadedAssets = []

    for (const file of files) {
      try {
        const exportMimeType = file.mimeType === 'application/vnd.google-apps.document'
          ? 'application/pdf'
          : file.mimeType === 'application/vnd.google-apps.spreadsheet'
            ? 'application/pdf'
            : file.mimeType === 'application/vnd.google-apps.presentation'
              ? 'application/pdf'
              : null

        let downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
        let actualMimeType = file.mimeType

        if (exportMimeType) {
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${exportMimeType}`
          actualMimeType = exportMimeType
        }

        const response = await $fetch(downloadUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          responseType: 'arrayBuffer',
        })

        const buffer = Buffer.from(new Uint8Array(response as ArrayBuffer))

        const result = await createAssetFromBuffer(
          buffer,
          file.name,
          actualMimeType,
          user.id,
          undefined,
          {
            originalSource: 'Google Drive',
            googleDriveFileId: file.id,
            originalMimeType: file.mimeType,
            downloadedAt: new Date().toISOString(),
          }
        )

        if (result.success && result.data) {
          uploadedAssets.push(result.data)
        }
      } catch (fileError) {
        log.error('Error downloading Google Drive file', { fileId: file.id, fileName: file.name, error: fileError })
      }
    }

    if (uploadedAssets.length === 0) {
      log.error('No Google Drive files were successfully downloaded as assets', {})
      throw createError({
        statusCode: 400,
        statusMessage: 'No Google Drive files were successfully downloaded as assets.',
      })
    }

    log.info('Google Drive files downloaded successfully', { count: uploadedAssets.length })
    return {
      success: true,
      data: uploadedAssets,
      message: `Successfully created ${uploadedAssets.length} asset(s) from Google Drive.`,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    log.error('Google Drive download error', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error during Google Drive file processing.',
    })
  }
})
