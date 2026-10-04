import { assetService } from '#layers/BaseShared/server/services/asset.service';
import { assetBlobKey, useAssetBlobStore } from '#layers/BaseShared/server/services/asset-blob-store';
import { readMultipartFormData, readBody } from 'h3'
import dayjs from 'dayjs'

const MIME_BY_EXTENSION: Record<string, string> = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'svg': 'image/svg+xml',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mov': 'video/quicktime',
  'avi': 'video/x-msvideo',
  'mkv': 'video/x-matroska',
  'pdf': 'application/pdf',
  'txt': 'text/plain'
}

const getMimeFromFilename = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return MIME_BY_EXTENSION[ext] || 'application/octet-stream'
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const contentType = getRequestHeader(event, 'content-type') || ''
    const isMultipart = contentType.startsWith('multipart/form-data')

    const uploadedAssets = []

    if (isMultipart) {
      // Primary path: multipart/form-data — streams raw bytes, safe for large videos
      const formData = await readMultipartFormData(event)
      const fileParts = formData?.filter(part => part.name === 'files' && part.filename && part.data) || []
      log.set({ filesCount: fileParts.length })

      if (fileParts.length === 0) {
        log.error('No files uploaded', {})
        throw createError({
          statusCode: 400,
          statusMessage: 'No files uploaded'
        })
      }

      const businessIdField = formData?.find(part => part.name === 'businessId')
      const businessId = businessIdField?.data?.toString() || undefined

      for (const part of fileParts) {
        try {
          const originalName = part.filename || 'file'
          const fileExtension = originalName.split('.').pop()?.toLowerCase() || 'bin'
          const uniqueFilename = crypto.randomUUID()
          const fullFilename = `${uniqueFilename}.${fileExtension}`
          const fileSize = part.data.length
          const mimeType = part.type || 'application/octet-stream'

          // Streams raw bytes straight through the storage seam (no base64/JSON overhead)
          const { url: fileUrl } = await useAssetBlobStore().put(
            assetBlobKey(user.id, fullFilename),
            Buffer.from(part.data),
            mimeType,
          )

          const assetData = {
            businessId,
            filename: uniqueFilename,
            originalName,
            mimeType,
            size: fileSize,
            url: fileUrl,
            metadata: {
              uploadedAt: dayjs().toDate(),
              originalSize: fileSize,
              storedPath: fullFilename
            }
          }

          const result = await assetService.create(user.id, assetData)

          if (result.success) {
            uploadedAssets.push(result.data)
          }
        } catch (fileError) {
          log.error('Error processing file', { fileName: part.filename, error: fileError })
          // Continue processing other files
        }
      }
    } else {
      // JSON payload — two supported shapes:
      //  1. URL import:      { url: 'https://...', filename?, originalName?, businessId? }  (uploadFromUrl)
      //  2. Direct metadata: { filename, originalName, mimeType, size, url, businessId? }    (createAsset)
      const body = await readBody<{
        url?: string
        filename?: string
        originalName?: string
        mimeType?: string
        size?: number
        businessId?: string
      }>(event)

      if (!body || (!body.url && !body.filename)) {
        log.error('No files uploaded', {})
        throw createError({
          statusCode: 400,
          statusMessage: 'No files uploaded'
        })
      }

      // Remote URL import: fetch the file server-side and store it
      if (body.url && /^https?:\/\//i.test(body.url)) {
        const urlFilename = body.filename || body.originalName || body.url.split('/').pop() || 'downloaded-asset'
        const fileExtension = urlFilename.split('.').pop()?.toLowerCase() || 'bin'
        const uniqueFilename = crypto.randomUUID()
        const fullFilename = `${uniqueFilename}.${fileExtension}`

        const remoteResponse = await $fetch<ArrayBuffer>(body.url)
        const buffer = Buffer.from(remoteResponse)
        const mimeType = getMimeFromFilename(urlFilename)

        const { url: fileUrl } = await useAssetBlobStore().put(
          assetBlobKey(user.id, fullFilename),
          buffer,
          mimeType,
        )

        const assetData = {
          businessId: body.businessId,
          filename: uniqueFilename,
          originalName: urlFilename,
          mimeType,
          size: buffer.length,
          url: fileUrl,
          metadata: {
            uploadedAt: dayjs().toDate(),
            originalSize: buffer.length,
            storedPath: fullFilename,
            sourceUrl: body.url
          }
        }

        const result = await assetService.create(user.id, assetData)

        if (result.success) {
          uploadedAssets.push(result.data)
        }
      } else if (body.filename && body.originalName && body.mimeType && body.url) {
        // Direct metadata create — the file is expected to already be stored
        const result = await assetService.create(user.id, {
          businessId: body.businessId,
          filename: body.filename,
          originalName: body.originalName,
          mimeType: body.mimeType,
          size: body.size ?? 0,
          url: body.url,
          metadata: {
            uploadedAt: dayjs().toDate()
          }
        })

        if (result.success) {
          uploadedAssets.push(result.data)
        }
      } else {
        log.error('Invalid upload payload', {})
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid upload payload'
        })
      }
    }

    if (uploadedAssets.length === 0) {
      log.error('No files were successfully uploaded', {})
      throw createError({
        statusCode: 400,
        statusMessage: 'No files were successfully uploaded'
      })
    }

    log.info('Files uploaded successfully', { count: uploadedAssets.length })
    return {
      success: true,
      data: uploadedAssets,
      message: `Successfully uploaded ${uploadedAssets.length} file(s)`
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    log.error('Asset upload error', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
