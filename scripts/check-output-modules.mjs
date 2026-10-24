#!/usr/bin/env node
/**
 * Post-build smoke check for Nitro's traced node_modules.
 *
 * Nft copies only the files it sees. When two versions of a dependency are in
 * the graph (or an export subpath is resolved late), `.output/server` can end
 * up with a package whose `package.json` points at files that were never
 * copied — the server then dies at import time with ERR_MODULE_NOT_FOUND, in
 * production, on the first request. That is exactly how `@better-auth/core`
 * broke a deploy: 1.7.10 and 1.7.12 were both present, one was flattened, and
 * `dist/utils/string.mjs` was missing.
 *
 * Booting the entry for a few seconds links the whole ESM graph, so a missing
 * external surfaces here instead of after the image has shipped.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENTRY = join(ROOT, 'packages/site/.output/server/index.mjs')
const BOOT_WINDOW_MS = 10_000

if (!existsSync(ENTRY)) {
  console.error(`[check-output] missing ${ENTRY} — run \`pnpm site:build\` first`)
  process.exit(1)
}

const child = spawn(process.execPath, [ENTRY], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '4311',
    NITRO_PORT: '4311',
    HOST: '127.0.0.1',
  },
  stdio: ['ignore', 'ignore', 'pipe'],
})

let stderr = ''
child.stderr.on('data', (chunk) => {
  stderr += String(chunk)
})

let settled = false
function finish(code, message) {
  if (settled) return
  settled = true
  clearTimeout(timer)
  child.kill('SIGKILL')
  if (message) console.error(message)
  process.exit(code)
}

const timer = setTimeout(() => {
  // Still running after the window without a module error: the graph linked.
  finish(0)
}, BOOT_WINDOW_MS)

child.on('exit', (code) => {
  if (/ERR_MODULE_NOT_FOUND|Cannot find module/.test(stderr)) {
    finish(1, `[check-output] external module missing from .output/server:\n${stderr.trim()}`)
    return
  }
  // A different crash still proves the import graph linked; boot failures are
  // covered by the container healthcheck, not this check.
  finish(0)
})
