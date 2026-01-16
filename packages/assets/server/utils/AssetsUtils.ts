import { type Asset } from '#layers/BaseDB/db/schema';
import { assetService } from '#layers/BaseAssets/server/services/asset.service';
import { join } from 'path';
import dayjs from 'dayjs';

const FILE_STORAGE_MOUNT = process.env.NUXT_FILE_STORAGE_MOUNT

export const getFileFromAsset = (asset: Asset) => {
  const filename = asset.url.replaceAll('/api/v1/assets/serve/', '')

  const fileStorageMount = FILE_STORAGE_MOUNT || './upload/files'
  const userFolder = join(process.cwd(), fileStorageMount, 'userFiles', asset.userId)
  const filePath = join(userFolder, filename)

  return filePath
}

export const createAssetFromBuffer = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  userId: string,
  businessId?: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; data?: Asset; error?: string }> => {
  try {
    // Generate unique filename
    const fileExtension = originalName.split('.').pop() || 'bin'
    const uniqueFilename = crypto.randomUUID()
    const fullFilename = `${uniqueFilename}.${fileExtension}`

    // Create user-specific folder path
    const userFolder = `/userFiles/${userId}`

    // Mimic ServerFile structure for storeFileLocally
    const serverFile = {
      name: fullFilename,
      type: mimeType,
      size: buffer.length,
      tempFilePath: '',
      content: `data:${mimeType};base64,${buffer.toString('base64')}`,
    }

    // Store file locally
    const storedFile = await storeFileLocally(serverFile, uniqueFilename, userFolder)

    // Create file URL
    const fileUrl = `/api/v1/assets/serve/${uniqueFilename}.${fileExtension}`

    // Create asset record
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
    console.error('Error creating asset from buffer:', error)
    return { success: false, error: 'Failed to create asset' }
  }
}
