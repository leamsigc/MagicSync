#!/usr/bin/env node
/**
 * Render a document through the MagicSync server and save a PNG preview.
 *
 * Usage:
 *   MAGICSYNC_API_TOKEN=org_… node scripts/render-preview.mjs template.json --out preview.png
 *   MAGICSYNC_COOKIE='better-auth.session_token=…' node scripts/render-preview.mjs template.json
 *
 * Options:
 *   --out PATH      Output file (default preview.png)
 *   --scale 0.5     Render scale (0.1–4)
 *   --format png    png | jpeg | webp
 *   --page 0        Page index
 *   --time 0        Animation time in ms
 *   --base URL      Override MAGICSYNC_BASE_URL
 */
import { writeFile } from 'node:fs/promises'
import { apiBase, authHeaders, ensureParent, parseArgs, readJson, unwrapDocument } from './_shared.mjs'

const args = parseArgs(process.argv.slice(2))
const input = args._[0]
if (!input) {
  console.error('usage: node scripts/render-preview.mjs <template.json> [--out preview.png]')
  process.exit(1)
}

const document = unwrapDocument(await readJson(input))
const base = apiBase(args.base)
const out = String(args.out ?? 'preview.png')
const body = {
  document,
  format: String(args.format ?? 'png'),
  scale: Number(args.scale ?? 0.5),
  page: Number(args.page ?? 0),
  timeMs: Number(args.time ?? 0),
}

let response
try {
  response = await fetch(`${base}/api/v1/image-editor/render`, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
} catch (error) {
  console.error(`Render request failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

if (!response.ok) {
  const detail = await response.text().catch(() => '')
  console.error(`Render failed: HTTP ${response.status} ${detail.slice(0, 500)}`)
  process.exit(1)
}

const buffer = Buffer.from(await response.arrayBuffer())
await ensureParent(out)
await writeFile(out, buffer)
const size = pngSize(buffer)
const warnings = Number(response.headers.get('x-render-warnings') ?? 0)
const fonts = response.headers.get('x-render-fonts') ?? ''

console.log(JSON.stringify({
  ok: true,
  out,
  bytes: buffer.length,
  width: size?.width ?? null,
  height: size?.height ?? null,
  renderWarnings: warnings,
  fonts: fonts ? fonts.split(',') : [],
  next: 'Open the PNG and check text clipping, contrast, margins and image crops.',
}, null, 2))

function pngSize(value) {
  if (value.length < 24) return null
  if (value.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: value.readUInt32BE(16), height: value.readUInt32BE(20) }
}
