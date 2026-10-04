import './h3-globals.mjs'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createApp, toNodeListener } from 'h3'
import { onceAsync, toHttpError } from '../server/api/v1/media/video-download.get.ts'

/**
 * Video-cropper remote ingest. The route resolves a public video page URL with
 * the existing yt-dlp util, streams the bytes straight to the browser and
 * unlinks the temp copy — it must never reach the asset library or the database.
 *
 * The happy path needs a real public URL (the SSRF gate rejects loopback), so it
 * only runs when VIDEO_DOWNLOAD_E2E_URL is set. Everything else is offline.
 */
const ROUTE = '/api/v1/media/video-download'
const E2E_URL = process.env.VIDEO_DOWNLOAD_E2E_URL

let server
let baseUrl
let handler

before(async () => {
  // No `.ts` suffix: resolve-hook matches this specifier exactly to hand back
  // the AuthHelpers stub rather than the real better-auth module.
  const auth = await import('#layers/BaseAuth/server/utils/AuthHelpers')
  auth.__setLoginResolver(async () => ({ id: 'video-cropper-test-user' }))
  const route = await import('../server/api/v1/media/video-download.get.ts')
  handler = route.default
  const app = createApp()
  app.use(ROUTE, handler)
  server = createServer(toNodeListener(app))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise(resolve => server.close(resolve))
})

async function fetchRoute(query) {
  return fetch(`${baseUrl}${ROUTE}${query}`)
}

describe('video-download route guards', () => {
  it('rejects a missing url before touching yt-dlp', async () => {
    const res = await fetchRoute('')
    assert.equal(res.status, 400)
    assert.equal((await res.json()).data.code, 'URL_REQUIRED')
  })

  it('rejects a loopback url as SSRF', async () => {
    const res = await fetchRoute('?url=http://127.0.0.1:8080/clip.mp4')
    assert.equal(res.status, 400)
    assert.equal((await res.json()).data.code, 'SSRF_BLOCKED')
  })

  it('rejects a private-network url as SSRF', async () => {
    const res = await fetchRoute('?url=https://192.168.1.10/clip.mp4')
    assert.equal(res.status, 400)
    assert.equal((await res.json()).data.code, 'SSRF_BLOCKED')
  })
})

describe('toHttpError mapping', () => {
  it('maps each yt-dlp failure onto a translatable code', () => {
    assert.deepEqual(toHttpError(new Error('YTDLP_NO_OUTPUT')), { statusCode: 502, code: 'YTDLP_NO_OUTPUT' })
    assert.deepEqual(toHttpError(new Error('YTDLP_FILE_TOO_LARGE')), { statusCode: 413, code: 'YTDLP_FILE_TOO_LARGE' })
    assert.deepEqual(toHttpError(new Error('Command failed: yt-dlp -- timed out')), { statusCode: 504, code: 'YTDLP_TIMEOUT' })
    assert.deepEqual(toHttpError(new Error('boom')), { statusCode: 502, code: 'YTDLP_FAILED' })
  })

  it('falls back to a generic code for a non-Error throw', () => {
    assert.deepEqual(toHttpError('nope'), { statusCode: 502, code: 'YTDLP_FAILED' })
  })
})

describe('onceAsync cleanup guard', () => {
  it('runs the wrapped cleanup exactly once even when called from several paths', async () => {
    let calls = 0
    const cleanup = onceAsync(async () => { calls += 1 })
    await Promise.all([cleanup(), cleanup()])
    await cleanup()
    assert.equal(calls, 1)
  })
})

describe('video-download happy path', () => {
  // A live public URL is required: the SSRF gate (correctly) refuses loopback,
  // so a local fixture server cannot stand in for the real source.
  it('streams mp4 bytes, labels them, and removes the temp copy', {
    skip: !E2E_URL && 'set VIDEO_DOWNLOAD_E2E_URL to a short public video URL',
  }, async () => {
    const before = await listTempDirs()
    const res = await fetchRoute(`?url=${encodeURIComponent(E2E_URL)}`)

    if (res.status !== 200) assert.fail(`expected 200, got ${res.status}: ${await res.text()}`)
    assert.equal(res.headers.get('content-type'), 'video/mp4')
    assert.equal(res.headers.get('cache-control'), 'no-store')
    const name = res.headers.get('x-video-id')
    assert.match(name, /^[A-Za-z0-9_-]+\.mp4$/)

    const bytes = Buffer.from(await res.arrayBuffer())
    assert.ok(bytes.length > 0, 'streamed body is non-empty')
    assert.equal(res.headers.get('content-length'), String(bytes.length))
    // `ftyp` at byte 4 is what makes this an actual MP4 rather than an HTML error page.
    assert.equal(bytes.subarray(4, 8).toString('ascii'), 'ftyp')

    const leaked = await waitForTempDirsToClear(before)
    assert.deepEqual(leaked, [], 'no yt-dlp temp dir survives the response')
  })
})

/** yt-dlp scratch dirs live under the configured (default) download dir. */
async function listTempDirs() {
  const { YTDLP_DOWNLOAD_DIR } = await import('../server/utils/ytdlp.ts')
  const entries = await readdir(YTDLP_DOWNLOAD_DIR).catch(() => [])
  return entries.filter(name => name.startsWith('msync-video-'))
}

/**
 * The client can finish reading before the handler's `finally` has awaited its
 * unlink, so give the async rm a settling window rather than asserting the
 * instant the body lands.
 */
async function waitForTempDirsToClear(before, attempts = 40, delayMs = 50) {
  let leaked = (await listTempDirs()).filter(dir => !before.includes(dir))
  for (let i = 0; i < attempts && leaked.length; i++) {
    await new Promise(resolve => setTimeout(resolve, delayMs))
    leaked = (await listTempDirs()).filter(dir => !before.includes(dir))
  }
  return leaked
}
