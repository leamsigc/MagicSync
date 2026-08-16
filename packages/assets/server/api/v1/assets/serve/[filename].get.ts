import { promises as fs } from 'node:fs'
import { resolve, sep, basename } from 'node:path'
import { assetService } from '#layers/BaseShared/server/services/asset.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const FILE_STORAGE_MOUNT = process.env.NUXT_FILE_STORAGE_MOUNT


  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const filename = getRouterParam(event, 'filename')
    log.set({ filename })

    if (!filename) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Filename is required'
      })
    }

    // SAFE: only use the basename so `..` / absolute paths cannot escape the user folder
    const safeName = basename(filename)
    if (!safeName || safeName === '.' || safeName === '..') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid filename' })
    }

    // Files are stored in the uploader's folder (userFiles/{asset.userId}/{uuid}.{ext})
    // and every stored file is backed by an assets row. Resolve the URL back to the
    // asset so we can (1) serve from the owner's folder — enabling business team access —
    // and (2) refuse to serve arbitrary files that are not tracked assets.
    const assetId = safeName.split('.')[0]!
    const asset = await assetService.getAssetByFilename(assetId)
    if (!asset) {
      throw createError({
        statusCode: 404,
        statusMessage: 'File not found'
      })
    }

    // Access control: the asset owner, or a member of the asset's business
    // organization (businessProfileService.findById handles owner + org-member).
    const isOwner = asset.userId === user.id
    const canAccessBusiness = asset.businessId
      ? (await businessProfileService.findById(asset.businessId, user.id, event)).success
      : false
    if (!isOwner && !canAccessBusiness) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden'
      })
    }

    // Construct the asset owner's folder path
    const fileStorageMount = FILE_STORAGE_MOUNT || './upload/files'
    const ownerFolder = resolve(process.cwd(), fileStorageMount, 'userFiles', asset.userId)
    const filePath = resolve(ownerFolder, safeName)
    if (filePath !== ownerFolder && !filePath.startsWith(ownerFolder + sep)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid filename' })
    }

    // Retrieve the file from local storage
    const fileContent = await fs.readFile(filePath)

    if (!fileContent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'File not found'
      })
    }

    // Determine content type (you might want to store this in the asset service or infer from filename)
    // For now, a simple inference based on common extensions
    let contentType = 'application/octet-stream'
    if (safeName.endsWith('.png')) contentType = 'image/png'
    else if (safeName.endsWith('.jpg') || safeName.endsWith('.jpeg')) contentType = 'image/jpeg'
    else if (safeName.endsWith('.gif')) contentType = 'image/gif'
    else if (safeName.endsWith('.pdf')) contentType = 'application/pdf'
    else if (safeName.endsWith('.mp4')) contentType = 'video/mp4'
    // Add more content types as needed

    setHeaders(event, {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${safeName}"` // 'inline' to display in browser, 'attachment' to download
    })

    return fileContent
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error serving asset:', error)
    log.error('Failed to serve asset', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
