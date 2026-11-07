#!/usr/bin/env node
/**
 * Save a document as an importable template, or create it directly through the API.
 *
 * File mode (default):
 *   node scripts/import-template.mjs template.json --id seed-design-spring --title "Spring sale"
 *   → writes packages/db/scripts/import-templates/seed-design-spring.json
 *   → run `pnpm design:seed` from the repo root to publish it to everyone.
 *
 * API mode:
 *   MAGICSYNC_API_TOKEN=org_… node scripts/import-template.mjs template.json \
 *     --mode api --title "Spring sale" --public
 *
 * Options:
 *   --mode file|api   Default: file
 *   --id ID           Import id (default seed-design-<slug>)
 *   --title TITLE     Design title
 *   --public          API mode: publish to the public template library
 *   --dir PATH        File mode output folder
 *   --force           Overwrite an existing file
 */
import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { apiBase, authHeaders, parseArgs, readJson, slugify, unwrapDocument } from './_shared.mjs'

const args = parseArgs(process.argv.slice(2))
const input = args._[0]
if (!input) {
  console.error('usage: node scripts/import-template.mjs <template.json> [--mode file|api] [--id ID] [--title TITLE] [--public]')
  process.exit(1)
}

const parsed = await readJson(input)
const document = unwrapDocument(parsed)
const title = String(args.title ?? parsed.title ?? 'Imported design')
const id = String(args.id ?? `seed-design-${slugify(title)}`)

if (String(args.mode ?? 'file') === 'api') {
  await importViaApi({ document, title })
} else {
  await writeImportFile({ document, title, id })
}

async function writeImportFile({ document, title, id }) {
  const dir = String(args.dir ?? await defaultImportDir())
  const path = join(dir, `${id}.json`)
  if (!args.force && await exists(path)) {
    console.error(`${path} already exists. Pass --force to overwrite.`)
    process.exit(1)
  }
  await mkdir(dir, { recursive: true })
  await writeFile(path, `${JSON.stringify({ id, title, document }, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    ok: true,
    mode: 'file',
    path,
    id,
    title,
    next: 'Run `pnpm design:seed` from the repo root, then open /tools/image-editor → Templates.',
  }, null, 2))
}

async function importViaApi({ document, title }) {
  const base = apiBase(args.base)
  let response
  try {
    response = await fetch(`${base}/api/v1/image-editor/designs`, {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ title, doc: document, isPublic: Boolean(args.public), meta: document.meta ?? {} }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (error) {
    console.error(`Import request failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error(`Import failed: HTTP ${response.status} ${detail.slice(0, 500)}`)
    process.exit(1)
  }
  const result = await response.json()
  console.log(JSON.stringify({
    ok: true,
    mode: 'api',
    id: result.id,
    title: result.title,
    public: Boolean(args.public),
    open: `${base}/tools/image-editor`,
    next: args.public
      ? 'Public template: it should appear in the studio Templates tab for every user.'
      : 'Private design: publish it from My Designs, or rerun with --public.',
  }, null, 2))
}

async function defaultImportDir() {
  const repoDir = 'packages/db/scripts/import-templates'
  return await exists(repoDir) ? repoDir : './import-templates'
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
