import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildYtdlpArgs, isYtdlpAvailable, MAX_VIDEO_BYTES } from '../server/utils/ytdlp.ts'

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
})
