import { execFile, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const YTDLP_BINARY = process.env.YTDLP_PATH ?? 'yt-dlp'
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024

export interface VideoDownload {
  id: string
  filePath: string
  bytes: number
  cleanup: () => Promise<void>
}

/** Array args only — never shell interpolation. */
export function buildYtdlpArgs(outputDir: string, url: string): string[] {
  return [
    '--no-playlist',
    '--restrict-filenames',
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

/** Download into a per-run temp dir; caller must call cleanup(). */
export async function downloadVideo(url: string, options: DownloadOptions = {}): Promise<VideoDownload> {
  const dir = await mkdtemp(join(tmpdir(), 'msync-video-'))
  const cleanup = () => rm(dir, { recursive: true, force: true })
  try {
    options.onProgress?.('downloading')
    await execFileAsync(YTDLP_BINARY, buildYtdlpArgs(dir, url), {
      timeout: options.timeoutMs ?? 120_000,
      maxBuffer: 8 * 1024 * 1024,
    })
    const files = (await readdir(dir)).filter(name => name.endsWith('.mp4'))
    const file = files[0]
    if (!file) throw new Error('YTDLP_NO_OUTPUT')
    const filePath = join(dir, file)
    const info = await stat(filePath)
    if (info.size > MAX_VIDEO_BYTES) throw new Error('YTDLP_FILE_TOO_LARGE')
    return { id: file.replace(/\.mp4$/, ''), filePath, bytes: info.size, cleanup }
  }
  catch (error) {
    await cleanup()
    throw error
  }
}
