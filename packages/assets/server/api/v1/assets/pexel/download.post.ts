import { assetService } from '#layers/BaseAssets/server/services/asset.service'

interface PexelsPhoto {
  id: number
  width: number
  height: number
  url: string
  photographer: string
  photographer_url: string
  photographer_id: number
  avg_color: string
  src: {
    original: string
    large2x: string
    large: string
    medium: string
    small: string
    portrait: string
    landscape: string
    tiny: string
  }
  liked: boolean
  alt: string
}

export default defineEventHandler(async (event) => {
  try {
    const user = await checkUserIsLogin(event)
    const { photos } = await readBody<{ photos: PexelsPhoto[] }>(event)

    if (!photos || photos.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No photos provided for download.',
      })
    }

    const uploadedAssets = []
    const userFolder = `/userFiles/${user.id}`

    for (const photo of photos) {
      try {
        const response = await $fetch(photo.src.original, { responseType: 'arrayBuffer' })
        const buffer = Buffer.from(response)

        const fileExtension = photo.src.original.split('.').pop() || 'jpeg'
        const uniqueFilename = crypto.randomUUID()
        const fullFilename = `${uniqueFilename}.${fileExtension}`

        // Mimic ServerFile structure for storeFileLocally
        const serverFile = {
          data: buffer.toString('base64'), // storeFileLocally expects base64 data
          name: fullFilename,
          type: `image/${fileExtension}`, // Guess content type
          size: buffer.length,
          tempFilePath: '', // Not used by storeFileLocally but required by type
        }

        const storedFile = await storeFileLocally(
          serverFile,
          uniqueFilename,
          userFolder,
        )

        const fileUrl = `/api/v1/assets/serve/${uniqueFilename}.${fileExtension}`

        const assetData = {
          filename: uniqueFilename,
          originalName: photo.alt || `pexels-photo-${photo.id}`,
          mimeType: `image/${fileExtension}`,
          size: buffer.length,
          url: fileUrl,
          metadata: {
            uploadedAt: new Date().toISOString(),
            originalSource: 'Pexels',
            pexelPhotoId: photo.id,
            photographer: photo.photographer,
            storedPath: storedFile,
          },
        }

        const result = await assetService.create(user.id, assetData)

        if (result.success) {
          uploadedAssets.push(result.data)
        }
      } catch (fileError) {
        console.error('Error processing Pexels photo:', photo.id, fileError)
        // Continue processing other files
      }
    }

    if (uploadedAssets.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No Pexels images were successfully uploaded as assets.',
      })
    }

    return {
      success: true,
      data: uploadedAssets,
      message: `Successfully created ${uploadedAssets.length} asset(s) from Pexels.`,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Pexels download API error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error during Pexels image processing.',
    })
  }
})
