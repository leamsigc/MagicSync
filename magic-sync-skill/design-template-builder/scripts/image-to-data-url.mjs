#!/usr/bin/env node
/**
 * Convert a local image to a data URL for embedding in a template.
 *
 * Usage:
 *   node scripts/image-to-data-url.mjs photo.jpg
 *   node scripts/image-to-data-url.mjs photo.png --max-mb 2 --out /tmp/photo.dataurl
 *
 * Prints the data URL to stdout (or writes it with --out). Warnings go to stderr.
 */
import { readFile, stat, writeFile } from 'node:fs/promises'
import { ensureParent, parseArgs } from './_shared.mjs'

const MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

const args = parseArgs(process.argv.slice(2))
const input = args._[0]
if (!input) {
  console.error('usage: node scripts/image-to-data-url.mjs <image> [--max-mb 2] [--out file]')
  process.exit(1)
}

const extension = String(input).split('.').pop()?.toLowerCase() ?? ''
const mime = String(args.mime ?? MIME[extension] ?? '')
if (!mime.startsWith('image/')) {
  console.error(`Unsupported image extension ".${extension}". Use png, jpg, jpeg, webp, gif or svg.`)
  process.exit(1)
}

const maxMb = Number(args['max-mb'] ?? 2)
const info = await stat(input)
const bytes = Number(info.size)
if (bytes > maxMb * 1024 * 1024) {
  console.error(`${input} is ${(bytes / 1024 / 1024).toFixed(2)} MB; the guard is ${maxMb} MB.`)
  console.error('Resize/compress it first, or use a public https:// URL so the import route can store it as a design asset.')
  process.exit(1)
}

const data = await readFile(input)
const url = `data:${mime};base64,${data.toString('base64')}`

if (args.out) {
  await ensureParent(String(args.out))
  await writeFile(String(args.out), `${url}\n`, 'utf8')
  console.error(`Wrote ${args.out} (${(bytes / 1024).toFixed(1)} KB source)`)
} else {
  process.stdout.write(`${url}\n`)
}
