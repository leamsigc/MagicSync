#!/usr/bin/env node
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

const timer = setTimeout(() => finish(0), BOOT_WINDOW_MS)

child.on('exit', () => {
  if (/ERR_MODULE_NOT_FOUND|Cannot find module/.test(stderr)) {
    const missing = stderr.match(/Cannot find (?:module|package) '([^']+)'/)?.[1] ?? 'unknown specifier'
    finish(1, [
      `[check-output] missing external module: ${missing}`,
      '[check-output] Nitro traced a package that does not contain the file the',
      '[check-output] runtime entry imports (usually two versions of the same',
      '[check-output] package in the graph, or a native binding staged later).',
      '',
      stderr.trim(),
    ].join('\n'))
    return
  }
  finish(0)
})
