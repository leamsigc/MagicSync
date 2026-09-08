import { getGoogleDriveToken } from '#layers/BaseAssets/server/utils/GoogleDriveUtils'

/**
 * Proxy a Google Drive file thumbnail through our server.
 *
 * Drive `thumbnailLink` URLs (lh3.googleusercontent.com) require Google
 * credentials the browser <img> request doesn't carry, so they render as
 * broken images (alt text only). This endpoint fetches the bytes with the
 * user's stored Drive token and streams them back same-origin.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const query = getQuery(event)
    const fileId = String(query.fileId || '')
    if (!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A valid Google Drive fileId is required.',
      })
    }

    const accessToken = await getGoogleDriveToken(user.id, useAuthApi(event).headers())
    if (!accessToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Google Drive not connected. Please connect Google Drive from the media library first.',
      })
    }

    const meta = await $fetch<{ hasThumbnail?: boolean; thumbnailLink?: string }>(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        query: { fields: 'id,hasThumbnail,thumbnailLink', supportsAllDrives: 'true' },
      }
    )

    if (!meta.thumbnailLink) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No preview available for this file.',
      })
    }

    const upstream = await $fetch<ArrayBuffer>(meta.thumbnailLink, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arrayBuffer',
    })

    setHeader(event, 'content-type', 'image/jpeg')
    setHeader(event, 'cache-control', 'private, max-age=3600')
    return Buffer.from(new Uint8Array(upstream))
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    log.error('Google Drive thumbnail error', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load Google Drive preview',
    })
  }
})
