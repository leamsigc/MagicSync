// Asset creation utility — sinks from packages/assets/server/utils/AssetsUtils.ts
// Used by bulk-scheduler (which doesn't extend assets)
// Depends on assetService (shared) and Nitro's storeFileLocally (server-side)
import { type Asset } from '#layers/BaseDB/db/schema';
import { assetService } from '#layers/BaseShared/server/services/asset.service';
import dayjs from 'dayjs';

export const createAssetFromBuffer = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  userId: string,
  businessId?: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; data?: Asset; error?: string }> => {
  try {
    const fileExtension = originalName.split('.').pop() || 'bin'
    const uniqueFilename = crypto.randomUUID()
    const fullFilename = `${uniqueFilename}.${fileExtension}`

    const userFolder = `/userFiles/${userId}`

    const serverFile = {
      name: fullFilename,
      type: mimeType,
      size: buffer.length,
      tempFilePath: '',
      content: `data:${mimeType};base64,${buffer.toString('base64')}`,
    }

    const storedFile = await storeFileLocally(serverFile, uniqueFilename, userFolder)

    const fileUrl = `/api/v1/assets/serve/${uniqueFilename}.${fileExtension}`

    const assetData = {
      businessId,
      filename: uniqueFilename,
      originalName,
      mimeType,
      size: buffer.length,
      url: fileUrl,
      metadata: {
        uploadedAt: dayjs().toDate(),
        originalSize: buffer.length,
        storedPath: storedFile,
        ...metadata
      }
    }

    const result = await assetService.create(userId, assetData)
    return result
  } catch (error) {
    log.error({ message: 'Error creating asset from buffer', error: String(error) })
    return { success: false, error: 'Failed to create asset' }
  }
}

export const getFileFromAsset = (asset: Asset) => {
  const filename = asset.url.replaceAll('/api/v1/assets/serve/', '')
  const fileStorageMount = process.env.NUXT_FILE_STORAGE_MOUNT || './upload/files'
  const userFolder = join(process.cwd(), fileStorageMount, 'userFiles', asset.userId)
  const filePath = join(userFolder, filename)
  return filePath
}
