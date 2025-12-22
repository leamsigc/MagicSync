import { type Asset } from '#layers/BaseDB/db/schema';
import { join } from 'path';

const FILE_STORAGE_MOUNT = process.env.NUXT_FILE_STORAGE_MOUNT

export const getFileFromAsset = (asset: Asset) => {
  const filename = asset.url.replaceAll('/api/v1/assets/serve/', '')

  const fileStorageMount = FILE_STORAGE_MOUNT || './upload/files'
  const userFolder = join(process.cwd(), fileStorageMount, 'userFiles', asset.userId)
  const filePath = join(userFolder, filename)

  return filePath
}
