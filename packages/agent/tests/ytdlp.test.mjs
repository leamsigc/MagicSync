import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildYtdlpArgs, isYtdlpAvailable, MAX_VIDEO_BYTES, PREFERRED_FORMAT, isBrowserSafeVideo } from '../server/utils/ytdlp.ts'

// T10 — yt-dlp ingestion. Arg builder is the security boundary (array args,
// never shell interpolation); the download path is skipped when the pinned
// binary is absent outside the Docker image.
describe('yt-dlp download (T10)', () => {
  it('builds array args with hardening flags', () => {
    const args = buildYtdlpArgs('/tmp/out', 'https://videos.example.com/clip.mp4')
    assert.ok(args.includes('--no-playlist'))
    assert.ok(args.includes('--restrict-filenames'))
    assert.ok(args.includes('--merge-output-format'))
    assert.equal(args[args.length - 1], 'https://videos.example.com/clip.mp4')
    const outputIndex = args.indexOf('-o')
    assert.match(args[outputIndex + 1], /\/tmp\/out\/%\(id\)s\.%\(ext\)s$/)
    assert.equal(Math.floor(MAX_VIDEO_BYTES / (1024 * 1024)), 200)
  })

  // Firefox/Linux has no AV1 WebCodecs decoder, so the browser would fail at
  // export time with "The given encoding is not supported".
  it('asks for H.264 + AAC and keeps an ordered fallback chain', () => {
    const args = buildYtdlpArgs('/tmp/out', 'https://videos.example.com/clip.mp4')
    assert.equal(args[args.indexOf('-f') + 1], PREFERRED_FORMAT)
    assert.ok(PREFERRED_FORMAT.includes('vcodec^=avc1'))
    assert.ok(PREFERRED_FORMAT.includes('acodec^=mp4a'))
    // Trailing catch-alls keep AV1-only sources downloadable instead of failing.
    assert.ok(PREFERRED_FORMAT.endsWith('/bv*+ba/b'))
    assert.equal(args[args.length - 1], 'https://videos.example.com/clip.mp4')
  })

  it('treats only h264 as browser-safe video', () => {
    assert.equal(isBrowserSafeVideo('h264'), true)
    assert.equal(isBrowserSafeVideo('av1'), false)
    assert.equal(isBrowserSafeVideo('vp9'), false)
    assert.equal(isBrowserSafeVideo('hevc'), false)
    // Unprobeable files are left untouched rather than transcoded blindly.
    assert.equal(isBrowserSafeVideo(null), true)
  })

  it('keeps the raw URL as exactly one array argument (no shell parsing)', () => {
    const evil = 'https://videos.example.com/clip.mp4; rm -rf /'
    const args = buildYtdlpArgs('/tmp/out', evil)
    assert.equal(args.filter(arg => arg === evil).length, 1)
    assert.equal(args[args.length - 1], evil)
  })

  it('downloads a video when yt-dlp is installed', { skip: !isYtdlpAvailable() && 'yt-dlp not installed (Docker-only test)' }, async () => {
    const { downloadVideo } = await import('../server/utils/ytdlp.ts')
    const http = await import('node:http')
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': '4' })
      res.end(Buffer.from([0, 0, 0, 0]))
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    try {
      const download = await downloadVideo(`http://127.0.0.1:${address.port}/clip.mp4`)
      assert.ok(download.bytes > 0)
      await download.cleanup()
    }
    finally {
      server.close()
    }
  })

  // A fresh container (or an unmounted volume) has no scratch dir yet, and
  // mkdtemp fails outright when its parent is missing.
  it('creates the scratch dir when it does not exist yet', { skip: !isYtdlpAvailable() && 'yt-dlp not installed (Docker-only test)' }, async () => {
    const { YTDLP_DOWNLOAD_DIR, downloadVideo } = await import('../server/utils/ytdlp.ts')
    const { existsSync } = await import('node:fs')
    const { rm } = await import('node:fs/promises')
    const http = await import('node:http')
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': '4' })
      res.end(Buffer.from([0, 0, 0, 0]))
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    await rm(YTDLP_DOWNLOAD_DIR, { recursive: true, force: true })
    assert.equal(existsSync(YTDLP_DOWNLOAD_DIR), false, 'scratch dir starts absent')
    try {
      const download = await downloadVideo(`http://127.0.0.1:${address.port}/clip.mp4`)
      assert.equal(existsSync(YTDLP_DOWNLOAD_DIR), true, 'scratch dir was created on demand')
      assert.ok(download.filePath.startsWith(YTDLP_DOWNLOAD_DIR), 'download lands inside it')
      await download.cleanup()
    }
    finally {
      server.close()
    }
  })
})
