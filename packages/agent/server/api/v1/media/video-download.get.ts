import { open } from 'node:fs/promises'
import type { H3Event } from 'h3'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { validatePublicSiteUrl } from '#layers/BaseDB/server/utils/url-allowlist'
import type { VideoDownload } from '../../../utils/ytdlp'
import { downloadVideo, isYtdlpAvailable } from '../../../utils/ytdlp'

/**
 * Stream a public video page URL (YouTube, Vimeo, …) into the browser as an
 * in-memory video, without ever persisting it.
 *
 * The yt-dlp binary has to write a real file to merge separate video/audio
 * streams, so the bytes land in a per-run temp dir first. That file is streamed
 * straight to the response and unlinked as soon as it settles — nothing reaches
 * the asset library or the database, so the browser holds the only copy. This is
 * the streaming sibling of the `download_video` agent tool, which does the
 * opposite and stores the result permanently.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const rawUrl = String(getQuery(event).url ?? '')
  log.set({ userId: user.id, sourceUrl: rawUrl })

  const safeUrl = await resolveSourceUrl(rawUrl)
  let download: VideoDownload | null = null
  let cleanup = onceAsync(async () => {})

  try {
    download = await downloadVideo(safeUrl)
    cleanup = onceAsync(download.cleanup)
    log.set({ videoId: download.id, bytes: download.bytes })
    return await streamDownload(event, download, cleanup)
  }
  catch (error) {
    const mapped = toHttpError(error)
    log.error('Remote video download failed', { code: mapped.code, status: mapped.statusCode })
    throw createError({ statusCode: mapped.statusCode, statusMessage: mapped.code, data: { code: mapped.code } })
  }
  finally {
    await cleanup()
  }
})

function safeFilename(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '') || 'video'
}

/** Map a yt-dlp failure onto a status code plus a code the client can translate. */
export function toHttpError(error: unknown): { statusCode: number, code: string } {
  const raw = error instanceof Error ? error.message : String(error)
  if (raw.includes('YTDLP_NO_OUTPUT')) return { statusCode: 502, code: 'YTDLP_NO_OUTPUT' }
  if (raw.includes('YTDLP_FILE_TOO_LARGE')) return { statusCode: 413, code: 'YTDLP_FILE_TOO_LARGE' }
  if (/timed out|ETIMEDOUT/i.test(raw)) return { statusCode: 504, code: 'YTDLP_TIMEOUT' }
  return { statusCode: 502, code: 'YTDLP_FAILED' }
}

/** Wrap cleanup so it runs exactly once whichever path settles the request. */
export function onceAsync(run: () => Promise<void>): () => Promise<void> {
  let done = false
  return async () => {
    if (done) return
    done = true
    await run()
  }
}

async function resolveSourceUrl(rawUrl: string): Promise<string> {
  if (!isYtdlpAvailable()) throw downloadError(503, 'YTDLP_UNAVAILABLE')
  if (!rawUrl) throw downloadError(400, 'URL_REQUIRED')
  // Returns an error string when the URL is rejected and null when it passes.
  const reason = await validatePublicSiteUrl(rawUrl)
  if (reason) throw downloadError(400, 'SSRF_BLOCKED')
  return rawUrl.trim()
}

function downloadError(statusCode: number, code: string) {
  return createError({ statusCode, statusMessage: code, data: { code } })
}

async function streamDownload(event: H3Event, download: VideoDownload, cleanup: () => Promise<void>): Promise<null> {
  const name = `${safeFilename(download.id)}.mp4`
  setResponseHeaders(event, {
    'Content-Type': 'video/mp4',
    'Content-Length': String(download.bytes),
    'Content-Disposition': `inline; filename="${name}"`,
    'Cache-Control': 'no-store',
    'X-Video-Id': name,
  })

  // Open the file before streaming so the inode stays pinned. Unlinking an open
  // file is safe on POSIX, so the temp dir can be removed even when h3 defers
  // writing the response body past the handler returning.
  const handle = await open(download.filePath, 'r')
  const res = event.node.res
  const onSettled = () => void cleanup()
  res.once('finish', onSettled)
  res.once('close', onSettled)

  await sendStream(event, handle.createReadStream())
  return null
}
