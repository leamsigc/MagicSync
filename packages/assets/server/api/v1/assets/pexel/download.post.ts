import { assetService } from '#layers/BaseAssets/server/services/asset.service'
import { safeFetch } from '#layers/BaseShared/server/utils/ssrf'
import { type ServerFile } from 'nuxt-file-storage'

const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

/** Pexels URLs come from the client — never let them choose the stored extension. */
const safeImageExtension = (originalUrl: string): string | null => {
  const extension = originalUrl.split('?')[0]?.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.has(extension) ? extension : 'jpeg'
}

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
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })
    const { photos } = await readBody<{ photos: PexelsPhoto[] }>(event)
    log.set({ photosCount: photos?.length || 0 })

    if (!photos || photos.length === 0) {
      log.error('No photos provided for download', {})
      throw createError({
        statusCode: 400,
        statusMessage: 'No photos provided for download.',
      })
    }

    const uploadedAssets = []
    const userFolder = `/userFiles/${user.id}`

    for (const photo of photos) {
      try {
        // `photo` comes straight from the request body, so the URL is
        // attacker-controlled: pinned-IP fetch + redirect re-validation.
        const response = await safeFetch(photo.src.large, { maxBytes: MAX_IMAGE_BYTES, timeoutMs: 15_000 })
        if (response.status < 200 || response.status >= 300) continue
        const buffer = response.body

        const fileExtension = safeImageExtension(photo.src.original)
        const uniqueFilename = crypto.randomUUID()
        const fullFilename = `${uniqueFilename}.${fileExtension}`

        // Mimic ServerFile structure for storeFileLocally
        const serverFile: ServerFile = {
          name: fullFilename,
          type: `image/${fileExtension}`,
          size: buffer.length,
          tempFilePath: '',
          content: `data:image/${fileExtension};base64,${buffer.toString('base64')}`,
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
        log.error('Error processing Pexels photo', { photoId: photo.id, error: fileError })
        // Continue processing other files
      }
    }

    if (uploadedAssets.length === 0) {
      log.error('No Pexels images were successfully uploaded as assets', {})
      throw createError({
        statusCode: 400,
        statusMessage: 'No Pexels images were successfully uploaded as assets.',
      })
    }

    log.info('Pexels images downloaded successfully', { count: uploadedAssets.length })
    return {
      success: true,
      data: uploadedAssets,
      message: `Successfully created ${uploadedAssets.length} asset(s) from Pexels.`,
    }
  } catch (error) {
    log.error('Pexels download API error', { error })
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error during Pexels image processing.',
    })
  }
})
