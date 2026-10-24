import { assetService } from '#layers/BaseShared/server/services/asset.service';
import { assetBlobKey, useAssetBlobStore } from '#layers/BaseShared/server/services/asset-blob-store';
import { safeFetch } from '#layers/BaseShared/server/utils/ssrf';
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

/** Uploads are content-typed by extension only — never by the client's `Content-Type`. */
const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_BY_EXTENSION))
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_BYTES = 250 * 1024 * 1024
const MAX_FILES_PER_REQUEST = 20
const SAFE_STORED_FILENAME = /^[A-Za-z0-9._-]{1,128}$/

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv'])

/** Write failures that mean the storage root is not usable, not that the input is bad. */
const STORAGE_ERROR_CODES = new Set(['EACCES', 'EPERM', 'ENOSPC', 'EROFS', 'EDQUOT'])

interface UploadFailure {
  fileName: string
  code?: string
  message: string
}

function maxBytesFor(extension: string): number {
  return VIDEO_EXTENSIONS.has(extension) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
}

function safeExtension(originalName: string): string | null {
  const extension = originalName.split('.').pop()?.toLowerCase() || ''
  return ALLOWED_EXTENSIONS.has(extension) ? extension : null
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
    const failures: UploadFailure[] = []

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

      if (fileParts.length > MAX_FILES_PER_REQUEST) {
        throw createError({ statusCode: 413, statusMessage: `At most ${MAX_FILES_PER_REQUEST} files per request` })
      }

      const businessIdField = formData?.find(part => part.name === 'businessId')
      const businessId = businessIdField?.data?.toString() || undefined

      for (const part of fileParts) {
        try {
          const originalName = part.filename || 'file'
          const fileExtension = safeExtension(originalName)
          if (!fileExtension) {
            log.error('Rejected upload with a disallowed extension', { fileName: originalName })
            failures.push({ fileName: originalName, code: 'UNSUPPORTED_EXTENSION', message: 'Unsupported file extension' })
            continue
          }
          if (part.data.length > maxBytesFor(fileExtension)) {
            log.error('Rejected oversized upload', { fileName: originalName, bytes: part.data.length })
            failures.push({ fileName: originalName, code: 'FILE_TOO_LARGE', message: 'File exceeds the size limit' })
            continue
          }

          const uniqueFilename = crypto.randomUUID()
          const fullFilename = `${uniqueFilename}.${fileExtension}`
          const fileSize = part.data.length
          // Never trust part.type: a .html uploaded as image/png would otherwise
          // be served back as HTML on the app origin.
          const mimeType = getMimeFromFilename(fullFilename)

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
          const code = (fileError as { code?: string } | null)?.code
          failures.push({
            fileName: part.filename ?? 'file',
            code,
            message: fileError instanceof Error ? fileError.message : String(fileError),
          })
          log.error('Error processing file', { fileName: part.filename, code, error: fileError })
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
        const fileExtension = safeExtension(urlFilename)
        if (!fileExtension) {
          throw createError({ statusCode: 415, statusMessage: 'Unsupported file extension' })
        }
        const uniqueFilename = crypto.randomUUID()
        const fullFilename = `${uniqueFilename}.${fileExtension}`

        // Pinned-IP fetch, redirect hops re-validated, body capped. A public URL
        // that redirects to 169.254.169.254 or db:8080 is rejected.
        const remoteResponse = await safeFetch(body.url, {
          maxBytes: maxBytesFor(fileExtension),
          timeoutMs: 20_000,
        })
        if (remoteResponse.status < 200 || remoteResponse.status >= 300) {
          throw createError({ statusCode: 502, statusMessage: 'Failed to fetch remote file' })
        }
        const buffer = remoteResponse.body
        const mimeType = getMimeFromFilename(fullFilename)

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
        if (!SAFE_STORED_FILENAME.test(body.filename)) {
          throw createError({ statusCode: 400, statusMessage: 'Invalid filename' })
        }
        if (!/^https?:\/\//i.test(body.url)) {
          throw createError({ statusCode: 400, statusMessage: 'Invalid asset URL' })
        }
        const result = await assetService.create(user.id, {
          businessId: body.businessId,
          filename: body.filename,
          originalName: body.originalName,
          mimeType: MIME_BY_EXTENSION[body.filename.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream',
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
      const storageFailure = failures.find(f => f.code && STORAGE_ERROR_CODES.has(f.code))
      if (storageFailure) {
        log.error('Asset storage write failed', { code: storageFailure.code, fileName: storageFailure.fileName })
        throw createError({
          statusCode: 500,
          statusMessage: 'Asset storage is not writable',
        })
      }
      log.error('No files were successfully uploaded', { failures })
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
