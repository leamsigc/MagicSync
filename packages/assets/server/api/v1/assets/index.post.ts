import { assetService } from '#layers/BaseAssets/server/services/asset.service';
import { auth } from '#layers/BaseAuth/lib/auth';
import { type ServerFile } from 'nuxt-file-storage'

export default defineEventHandler(async (event) => {
  try {
    // Get user from session
    const user = await checkUserIsLogin(event)

    // Handle nuxt-file-storage files
    const { files } = await readBody<{ files: ServerFile[] }>(event)

    if (!files || files.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No files uploaded'
      })
    }

    const uploadedAssets = []

    // Create user-specific folder path
    const userFolder = `/userFiles/${user.id}`

    // Process each uploaded file
    for (const file of files) {
      try {
        // Generate unique filename with original extension
        const fileExtension = file.name.split('.').pop() || ''
        const uniqueFilename = crypto.randomUUID()

        // Store file locally using nuxt-file-storage
        const storedFile = await storeFileLocally(
          file,
          uniqueFilename,
          userFolder
        )

        // Get file size from the stored file or original file, ensure it's a number
        const fileSize = typeof file.size === 'string' ? parseInt(file.size, 10) : (file.size || 0)

        // Create asset record with proper URL
        const fileUrl = `/api/v1/assets/serve/${uniqueFilename}.${fileExtension}`

        const assetData = {
          filename: uniqueFilename,
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: fileSize,
          url: fileUrl, // URL to serve the file
          metadata: {
            uploadedAt: new Date().toISOString(),
            originalSize: fileSize,
            storedPath: storedFile
          }
        }

        const result = await assetService.create(user.id, assetData)

        if (result.success) {
          uploadedAssets.push(result.data)
        }
      } catch (fileError) {
        console.error('Error processing file:', file.name, fileError)
        // Continue processing other files
      }
    }

    if (uploadedAssets.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No files were successfully uploaded'
      })
    }

    return {
      success: true,
      data: uploadedAssets,
      message: `Successfully uploaded ${uploadedAssets.length} file(s)`
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Asset upload error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
