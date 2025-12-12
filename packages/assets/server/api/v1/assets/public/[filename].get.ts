import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { assetService } from '#layers/BaseAssets/server/services/asset.service'

export default defineEventHandler(async (event) => {
  try {
    const filename = getRouterParam(event, 'filename')
    const { FILE_STORAGE_MOUNT } = useRuntimeConfig(event)

    if (!filename) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Filename is required'
      })
    }

    // Look up the asset by filename to check if it's public
    const asset = await assetService.getAssetByFilename(filename)

    if (!asset) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Asset not found'
      })
    }

    // Check if asset is public
    if (!asset.isPublic) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied - Asset is not public'
      })
    }

    // Construct the user-specific folder path using asset's userId
    const fileStorageMount = FILE_STORAGE_MOUNT || './upload/files'
    const userFolder = join(process.cwd(), fileStorageMount, 'userFiles', asset.userId)
    const filePath = join(userFolder, filename)

    // Retrieve the file from local storage
    const fileContent = await fs.readFile(filePath)

    if (!fileContent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'File not found'
      })
    }

    // Use mimeType from asset record, fallback to inference
    let contentType = asset.mimeType || 'application/octet-stream'
    if (contentType === 'application/octet-stream') {
      // Fallback to extension-based inference
      if (filename.endsWith('.png')) contentType = 'image/png'
      else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) contentType = 'image/jpeg'
      else if (filename.endsWith('.gif')) contentType = 'image/gif'
      else if (filename.endsWith('.pdf')) contentType = 'application/pdf'
      else if (filename.endsWith('.mp4')) contentType = 'video/mp4'
    }

    setHeaders(event, {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"` // 'inline' to display in browser, 'attachment' to download
    })

    return fileContent
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error serving asset:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
