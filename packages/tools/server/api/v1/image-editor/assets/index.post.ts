import { readMultipartFormData } from 'h3'
import { mimeForAsset, writeDesignAsset } from '../../../../utils/design-asset-store'
import { requireDesignAuth } from '../../../../utils/design-auth'

/**
 * Upload a background-music track for the design's MP4 export.
 *
 * Files land in the public design-asset store so the MP4 route can read them
 * directly (no HTTP round trip) and the editor can preview the track.
 */

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac'])
const MAX_AUDIO_BYTES = 20 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const principal = await requireDesignAuth(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.filename && part.data)
  if (!file) throw createError({ statusCode: 400, statusMessage: 'No audio file uploaded' })

  const extension = String(file.filename).split('.').pop()?.toLowerCase() ?? ''
  if (!AUDIO_EXTENSIONS.has(extension)) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported audio format (use mp3, wav, m4a, aac, ogg or flac)' })
  }
  if (file.data.length === 0 || file.data.length > MAX_AUDIO_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Audio file must be between 1 byte and 20 MB' })
  }

  const name = `${crypto.randomUUID()}.${extension}`
  const written = await writeDesignAsset(name, file.data)
  log.set({ userId: principal.userId, name, bytes: file.data.length })
  return { url: written.url, name, mimeType: mimeForAsset(name), bytes: written.bytes }
})
