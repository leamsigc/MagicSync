#!/usr/bin/env node
/**
 * Boot every layer's `.playground` in isolation and report which ones come up.
 *
 * This is the empirical form of the layer-restructure claim "feature layers are
 * libraries". Each playground extends only its own package, so a playground that
 * boots proves nothing it needs comes from a sibling feature layer. A playground
 * that fails names the broken import in its own log, with no site to hide it.
 *
 * A layer passes when Nitro reports its server bundle built AND a layer-owned
 * route loads its handler. A 401 or 404 is a pass: the handler ran and the
 * auth guard or the stub answered. Only a 5xx whose body names the module graph
 * (`is not defined in package`, or a TDZ `before initialization`) fails, because
 * those are the two ways a broken layer edge shows up at runtime. An endpoint
 * that deliberately answers 501 via `notPorted` is working as designed.
 *
 * Usage:
 *   node scripts/playground-boot.mjs                 # every layer
 *   node scripts/playground-boot.mjs scheduler tools # named layers
 *   KEEP_LOGS=1 node scripts/playground-boot.mjs      # keep passing logs too
 *
 * No build is run. One dev server at a time, each fully reaped before the next
 * starts, so peak memory stays at a single layer's dev server.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACKAGES = join(ROOT, 'packages')
const LOG_DIR = join(ROOT, '.playground-logs')

const PORT_BASE = Number(process.env.PORT_BASE ?? 3401)
const BOOT_TIMEOUT_MS = Number(process.env.BOOT_TIMEOUT_MS ?? 150000)
const HEAP_MB = Number(process.env.HEAP_MB ?? 3072)
const KEEP_LOGS = process.env.KEEP_LOGS === '1'
// Nuxt transforms a route's module graph on first hit, which on the heaviest
// layers takes longer than a cold-boot budget. Measured: ai-tools needs ~80s
// for its first route response while Nitro itself reports built in ~8s.
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 120000)

const NITRO_BUILT = /Nuxt Nitro server built in|✔ Nuxt Nitro server built/

const firstLine = text => text.split('\n').find(line => line.trim())?.trim().slice(0, 160)

/** First API route under a layer's server/api, as a URL path. */
function probeRoute(layerDir) {
  const apiDir = join(layerDir, 'server/api')
  if (!existsSync(apiDir)) return null
  const stack = [apiDir]
  while (stack.length) {
    const dir = stack.shift()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) { stack.push(full); continue }
      const route = full
        .slice(apiDir.length)
        .replace(/\.(get|post|put|patch|delete|head|options)\.ts$/, '')
        .replace(/\/index$/, '')
        .replace(/\[(\w+)\]/g, '_1')
      return `/api${route}`
    }
  }
  return null
}

function listLayers() {
  return readdirSync(PACKAGES, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => existsSync(join(PACKAGES, name, '.playground')))
    .sort()
}

/**
 * `npx nuxi` spawns the real server as a grandchild, so killing the direct
 * child leaves a live process holding the port and ~2 GB. Run the binary
 * directly and tear down the whole process group instead.
 */
function killTree(child) {
  try { process.kill(-child.pid, 'SIGKILL') }
  catch { child.kill('SIGKILL') }
}

function boot(layer, port) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [join(PACKAGES, layer, 'node_modules/nuxt/bin/nuxt.mjs'), 'dev', '.playground', '--port', String(port)],
      {
        cwd: join(PACKAGES, layer),
        env: { ...process.env, NODE_OPTIONS: `--max-old-space-size=${HEAP_MB}` },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      },
    )
    let output = ''
    let settled = false
    let retried = false
    let lastError
    const collect = chunk => { output += chunk.toString() }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)

    const finish = result => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // Resolving only after the process group is gone matters. A dev server
      // holds ~2 GB, and starting the next layer while the previous one is
      // still tearing down gets the new one OOM-killed ("Killed", fetch
      // failed) instead of reporting a real defect.
      killTree(child)
      const lock = join(PACKAGES, layer, '.playground/.nuxt/nuxt.lock')
      setTimeout(() => {
        // SIGKILL gives Nuxt no chance to release its dev lock, so the next run
        // of this playground would refuse to start.
        rmSync(lock, { force: true })
        resolve({ ...result, log: output })
      }, 3000)
    }
    const timer = setTimeout(() => finish({ ok: false, reason: 'boot-timeout' }), BOOT_TIMEOUT_MS)

    const poll = setInterval(async () => {
      if (settled) return
      if (!NITRO_BUILT.test(output)) return
      const route = probeRoute(join(PACKAGES, layer))
      if (!route) { finish({ ok: true, reason: 'no-api-route', status: null }); return }
      try {
        const res = await fetch(`http://localhost:${port}${route}`, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        const body = await res.text()
        const brokenImport = /is not defined in package|Cannot access .* before initialization/.test(body)
        finish({
          ok: !brokenImport,
          reason: brokenImport ? 'unresolved-import' : (res.status >= 500 ? 'route-5xx' : 'route-answered'),
          status: res.status,
          route,
          detail: brokenImport ? firstLine(body) : undefined,
        })
        return
      }
      catch (error) {
        // A cold route transform can outrun the request budget on the heavier
        // layers. Retry once; a second hit is served from the warm graph.
        if (!retried) { retried = true; lastError = error.message; return }
        finish({ ok: false, reason: 'route-unreachable', detail: lastError ?? error.message })
      }
    }, 2000)
  })
}

const requested = process.argv.slice(2)
const layers = requested.length ? requested : listLayers()
mkdirSync(LOG_DIR, { recursive: true })

const results = []
for (const [index, layer] of layers.entries()) {
  const port = PORT_BASE + index
  process.stdout.write(`${layer.padEnd(16)} port ${port} ... `)
  const result = await boot(layer, port)
  const logPath = join(LOG_DIR, `${layer}.log`)
  if (KEEP_LOGS || !result.ok) writeFileSync(logPath, result.log)
  else rmSync(logPath, { force: true })
  const detail = result.status ? `HTTP ${result.status} ${result.route}` : result.reason
  process.stdout.write(`${result.ok ? 'PASS' : 'FAIL'}  ${detail}\n`)
  if (!result.ok) process.stdout.write(`${''.padEnd(20)}log: ${logPath}\n`)
  results.push({ layer, ...result })
}

writeFileSync(join(LOG_DIR, 'summary.json'), `${JSON.stringify(results, null, 2)}\n`)
const failed = results.filter(result => !result.ok)
process.stdout.write(`\n${results.length - failed.length}/${results.length} playgrounds boot\n`)
process.exit(failed.length ? 1 : 0)