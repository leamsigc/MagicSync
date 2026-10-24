import { promises as fs } from 'node:fs'
import { basename, resolve, sep } from 'node:path'
import { assetService } from '#layers/BaseShared/server/services/asset.service'

/**
 * Public asset delivery.
 *
 * Everything here is reachable without a session, so the path handling is
 * deliberately paranoid: basename only, resolved inside the owner's folder,
 * and served with `nosniff` + `attachment` for anything that a browser could
 * interpret as executable markup.
 */
const INLINE_SAFE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'pdf'])

function safeContentType(filename: string, mimeType?: string | null): string {
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'mp4') return 'video/mp4'
  if (extension === 'webm') return 'video/webm'
  // Never echo a client-declared MIME type for anything else.
  return mimeType === 'application/octet-stream' ? mimeType : 'application/octet-stream'
}

export default defineEventHandler(async (event) => {
  try {
    const filenameParam = getRouterParam(event, 'filename')
    const filename = basename(filenameParam ?? '').replace(/["\r\n]/g, '')
    const filenameId = filename.split('.')[0]

    if (!filename || !filenameId || filename === '.' || filename === '..') {
      throw createError({ statusCode: 400, statusMessage: 'Filename is required' })
    }

    const asset = await assetService.getAssetByFilename(filenameId)
    if (!asset) {
      throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
    }
    if (!asset.isPublic) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied - Asset is not public' })
    }

    const fileStorageMount = process.env.NUXT_FILE_STORAGE_MOUNT || './upload/files'
    const ownerFolder = resolve(process.cwd(), fileStorageMount, 'userFiles', asset.userId)
    const filePath = resolve(ownerFolder, filename)
    if (!filePath.startsWith(`${ownerFolder}${sep}`)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid file path' })
    }

    const fileContent = await fs.readFile(filePath)
    const extension = filename.split('.').pop()?.toLowerCase() ?? ''
    const inline = INLINE_SAFE_EXTENSIONS.has(extension)

    setHeaders(event, {
      'Content-Type': safeContentType(filename, asset.mimeType),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
      'Cache-Control': 'public, max-age=3600',
    })

    return fileContent
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    log.error({ message: 'Error serving asset', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
