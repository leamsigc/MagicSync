import { execFile, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, rename, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** Read a positive integer env var, falling back when unset or malformed. */
function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name])
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

/** Read a tri-state flag; only an explicit falsy value turns it off. */
function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  return raw !== '0' && raw.toLowerCase() !== 'false'
}

// Accept the bare name (Dockerfile sets YTDLP_PATH) and the Nuxt-prefixed one
// that `.env` follows convention with, so neither is silently ignored.
export const YTDLP_BINARY = process.env.YTDLP_PATH || process.env.NUXT_YTDLP_PATH || 'yt-dlp'

export const MAX_VIDEO_BYTES = envInt('YTDLP_MAX_MB', 200) * 1024 * 1024
export const DOWNLOAD_TIMEOUT_MS = envInt('YTDLP_TIMEOUT_MS', 120_000)

/**
 * Re-encode a non-H.264 download to H.264/AAC before handing it on. Off with
 * YTDLP_BROWSER_SAFE=0.
 */
export const BROWSER_SAFE_ENABLED = envFlag('YTDLP_BROWSER_SAFE', true)
export const TRANSCODE_TIMEOUT_MS = envInt('YTDLP_TRANSCODE_TIMEOUT_MS', 300_000)

/**
 * Scratch parent for yt-dlp runs, created on demand. Defaults to a stable folder
 * under the OS temp dir; point it at a mounted volume in production so large
 * downloads do not land on the container's small overlay /tmp.
 */
export const YTDLP_DOWNLOAD_DIR = process.env.YTDLP_DOWNLOAD_DIR
  || process.env.NUXT_YTDLP_DOWNLOAD_DIR
  || join(tmpdir(), 'magicsync-video')

export interface VideoDownload {
  id: string
  filePath: string
  bytes: number
  cleanup: () => Promise<void>
}

/**
 * Ask for browser-safe codecs: H.264 video + AAC audio inside an MP4 container.
 *
 * Both consumers re-encode in a browser, so the source codec must be one the
 * browser can *decode* first — Firefox on Linux, for example, has no AV1
 * WebCodecs decoder, and silently receiving AV1 produces a browser-side
 * "The given encoding is not supported" failure at export time rather than a
 * download-time error.
 *
 * The selector is an ordered chain so a source that publishes no H.264 at all
 * still downloads instead of erroring: best avc1+m4a → best avc1 → best of
 * anything → best overall. Those leftovers are converted by
 * {@link ensureBrowserSafeVideo} rather than rejected.
 */
export const PREFERRED_FORMAT = [
  'bv*[ext=mp4][vcodec^=avc1]',
  'ba[ext=m4a][acodec^=mp4a]',
].join('+') + '/b[ext=mp4][vcodec^=avc1]/bv*+ba/b'

/** Array args only — never shell interpolation. */
export function buildYtdlpArgs(outputDir: string, url: string): string[] {
  return [
    '--no-playlist',
    '--restrict-filenames',
    '--extractor-args',
    'youtube:player_client=android',
    '-f',
    PREFERRED_FORMAT,
    '--max-filesize',
    `${Math.floor(MAX_VIDEO_BYTES / (1024 * 1024))}M`,
    '--merge-output-format',
    'mp4',
    '-o',
    join(outputDir, '%(id)s.%(ext)s'),
    url,
  ]
}

export function isYtdlpAvailable(): boolean {
  if (YTDLP_BINARY.includes('/')) return existsSync(YTDLP_BINARY)
  const probe = spawnSync(YTDLP_BINARY, ['--version'], { stdio: 'ignore' })
  return probe.status === 0
}

export interface DownloadOptions {
  timeoutMs?: number
  onProgress?: (stage: string) => void
}

export interface SourceTracks {
  videoCodec: string | null
  hasAudio: boolean
}

interface ProbeStream {
  codec_type?: string
  codec_name?: string
}

/**
 * ffprobe's CSV writer emits fields in its own order, not the order they were
 * requested in, so parse the keyed JSON form instead of trusting positions.
 */
function parseProbeOutput(stdout: string): SourceTracks {
  const streams: ProbeStream[] = JSON.parse(stdout).streams ?? []
  const video = streams.find(s => s.codec_type === 'video')
  return {
    videoCodec: video?.codec_name ?? null,
    hasAudio: streams.some(s => s.codec_type === 'audio'),
  }
}

/** Probe for an executable on PATH. */
function hasBinary(name: string): boolean {
  return spawnSync(name, ['-version'], { stdio: 'ignore' }).status === 0
}

/** Read the first video/audio codecs of a file, or nulls when it cannot be probed. */
async function probeSourceTracks(filePath: string): Promise<SourceTracks> {
  const empty: SourceTracks = { videoCodec: null, hasAudio: false }
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'stream=codec_type,codec_name',
      '-of', 'json',
      filePath,
    ], { timeout: 30_000 })
    return parseProbeOutput(stdout)
  }
  catch {
    return empty
  }
}

export function isBrowserSafeVideo(codec: string | null): boolean {
  return codec === null || codec === 'h264'
}

function buildTranscodeArgs(filePath: string, hasAudio: boolean): string[] {
  return [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', filePath,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
    '-movflags', '+faststart',
    `${filePath}.safe.mp4`,
  ]
}

/**
 * Convert a downloaded file to H.264 (+ AAC) in place.
 *
 * Reached only for sources that publish no H.264 at all — some Facebook reels
 * are AV1-only, so no format selector can help. Returns whether a transcode ran;
 * on failure the original file is left untouched and returned as-is.
 */
export async function ensureBrowserSafeVideo(filePath: string): Promise<boolean> {
  if (!BROWSER_SAFE_ENABLED) return false
  // Without ffprobe we cannot tell AV1 from H.264, so leave the file alone
  // rather than transcoding speculatively.
  if (!hasBinary('ffprobe') || !hasBinary('ffmpeg')) return false
  const { videoCodec, hasAudio } = await probeSourceTracks(filePath)
  if (isBrowserSafeVideo(videoCodec)) return false
  const transcoded = `${filePath}.safe.mp4`
  await execFileAsync('ffmpeg', buildTranscodeArgs(filePath, hasAudio), { timeout: TRANSCODE_TIMEOUT_MS })
  await rm(filePath, { force: true })
  await rename(transcoded, filePath)
  return true
}

/** Download into a per-run temp dir; caller must call cleanup(). */
export async function downloadVideo(url: string, options: DownloadOptions = {}): Promise<VideoDownload> {
  // The configured scratch dir may not exist yet (fresh container, or a volume
  // that has not been mounted). mkdtemp requires an existing parent.
  await mkdir(YTDLP_DOWNLOAD_DIR, { recursive: true })
  const dir = await mkdtemp(join(YTDLP_DOWNLOAD_DIR, 'msync-video-'))
  const cleanup = () => rm(dir, { recursive: true, force: true })
  try {
    options.onProgress?.('downloading')
    await execFileAsync(YTDLP_BINARY, buildYtdlpArgs(dir, url), {
      timeout: options.timeoutMs ?? DOWNLOAD_TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024,
    })
    const files = (await readdir(dir)).filter(name => name.endsWith('.mp4'))
    const file = files[0]
    if (!file) throw new Error('YTDLP_NO_OUTPUT')
    const filePath = join(dir, file)
    let info = await stat(filePath)
    if (info.size > MAX_VIDEO_BYTES) throw new Error('YTDLP_FILE_TOO_LARGE')

    if (await ensureBrowserSafeVideo(filePath)) {
      options.onProgress?.('transcoding')
      info = await stat(filePath)
      if (info.size > MAX_VIDEO_BYTES) throw new Error('YTDLP_FILE_TOO_LARGE')
    }
    return { id: file.replace(/\.mp4$/, ''), filePath, bytes: info.size, cleanup }
  }
  catch (error) {
    await cleanup()
    throw error
  }
}
