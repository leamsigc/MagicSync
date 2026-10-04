#!/usr/bin/env node
/**
 * Audit cross-layer imports against each layer's own `extends`.
 *
 * A layer can only import `#layers/Base*` aliases for packages it actually
 * extends, transitively. An import of a layer you do not extend still resolves
 * at the site composition root, so the site dev server hides it while the
 * layer's own playground breaks. That is the "hidden broken layering" the
 * layer restructure set out to remove, and a static "0 feature→feature edges"
 * claim is only as good as this check.
 *
 * The alias table is read from a generated tsconfig rather than derived. Three
 * aliases defy any capitalisation rule — `BaseDB`, `BaseAITools` and
 * `BaseTemplate` (for `templates`) — so a derived guess reports hundreds of
 * false violations.
 *
 * Layer debt is real debt, not a reason to switch the check off. The audit is
 * therefore pinned to a committed baseline: violations already recorded are
 * tolerated, and only a *new* one fails. Fixing a violation retires it (the
 * audit says so, and `--update-baseline` shrinks the file), so the debt can
 * only shrink. Without this the check would have to be either absent or
 * permanently red, and both were the status quo.
 *
 * Usage:
 *   node scripts/layer-import-audit.mjs                  compare against baseline
 *   node scripts/layer-import-audit.mjs --strict         ignore baseline, report all
 *   node scripts/layer-import-audit.mjs --update-baseline  rewrite the baseline
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACKAGES = join(ROOT, 'packages')
const BASELINE_PATH = join(ROOT, 'scripts/layer-import-baseline.json')
const argv = new Set(process.argv.slice(2))

const layers = readdirSync(PACKAGES, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .filter(name => existsSync(join(PACKAGES, name, 'package.json')))

const IMPORT_SPEC = /#layers\/Base[A-Za-z0-9]+[^'"\s)]*/g

/** layer directory -> alias segment, read from Nuxt's own generated config. */
function aliasMap() {
  const configPath = join(PACKAGES, 'site/.nuxt/tsconfig.json')
  if (!existsSync(configPath)) {
    process.stderr.write(
      `ERROR  ${configPath} is missing.\n` +
      '       The alias table is read from the generated Nuxt config, so the site layer\n' +
      '       must be prepared first: pnpm --filter @local-monorepo/site exec nuxt prepare\n',
    )
    process.exit(2)
  }
  const source = readFileSync(configPath, 'utf8').replace(/^\s*\/\/.*$/gm, '')
  const { compilerOptions } = JSON.parse(source)
  const map = new Map()
  for (const [alias, targets] of Object.entries(compilerOptions.paths ?? {})) {
    const match = alias.match(/^#layers\/Base([A-Za-z0-9]+)$/)
    if (!match) continue
    const directory = targets[0].split('/').pop()
    if (existsSync(join(PACKAGES, directory))) map.set(directory, match[1])
  }
  return map
}

/** `extends` entries are workspace package names, so map them to directories. */
function directoryFor(spec) {
  const tail = spec.split('/').pop()
  return existsSync(join(PACKAGES, tail)) ? tail : null
}

/** Transitive closure of `extends` for one layer, as directory names. */
function extendsClosure(layer) {
  const seen = new Set([layer])
  const queue = [layer]
  while (queue.length) {
    const current = queue.shift()
    const configPath = join(PACKAGES, current, 'nuxt.config.ts')
    if (!existsSync(configPath)) continue
    const source = readFileSync(configPath, 'utf8')
    const block = source.match(/extends:\s*\[([^\]]*)\]/s)
    if (!block) continue
    for (const raw of block[1].split(',')) {
      const spec = raw.trim().replace(/^['"`]|['"`]$/g, '')
      const name = directoryFor(spec)
      if (!name || seen.has(name)) continue
      seen.add(name)
      queue.push(name)
    }
  }
  return seen
}

function* sourceFiles(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.nuxt' || entry.name === '.output' || entry.name === '.playground') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* sourceFiles(full)
    else if (/\.(ts|vue|js|mts|mjs)$/.test(entry.name)) yield full
  }
}

const aliases = aliasMap()
const violations = []
let checked = 0

for (const layer of layers) {
  const reachable = extendsClosure(layer)
  const reachableAliases = new Set([...reachable].map(dir => aliases.get(dir)).filter(Boolean))
  for (const dir of ['app', 'server', 'shared']) {
    for (const file of sourceFiles(join(PACKAGES, layer, dir))) {
      const source = readFileSync(file, 'utf8')
      for (const spec of source.match(IMPORT_SPEC) ?? []) {
        checked++
        const target = spec.match(/^#layers\/Base([A-Za-z0-9]+)/)?.[1]
        if (!target || reachableAliases.has(target)) continue
        violations.push({
          layer,
          file: file.slice(ROOT.length),
          spec,
          targetLayer: [...aliases].find(([, alias]) => alias === target)?.[0] ?? target,
          extends: [...reachable].sort(),
        })
      }
    }
  }
}

const keyOf = violation => `${violation.layer}|${violation.file}|${violation.spec}`

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set()
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  return new Set(parsed.violations ?? [])
}

function writeBaseline(violations) {
  const sorted = violations.map(keyOf).sort()
  writeFileSync(BASELINE_PATH, `${JSON.stringify({
    note: 'Known layer violations tolerated by scripts/layer-import-audit.mjs. Shrinks as they are fixed; regenerate with --update-baseline.',
    count: sorted.length,
    violations: sorted,
  }, null, 2)}\n`)
  return sorted.length
}

/** Split findings into ones the baseline already tolerates and genuinely new ones. */
function partition(violations, baseline) {
  const added = []
  const known = []
  for (const violation of violations) {
    if (baseline.has(keyOf(violation))) known.push(violation)
    else added.push(violation)
  }
  return { added, known }
}

function describe(violation) {
  process.stdout.write(`${violation.layer}  ->  ${violation.targetLayer}\n`)
  process.stdout.write(`  ${violation.file}\n`)
  process.stdout.write(`  import ${violation.spec}\n`)
  process.stdout.write(`  ${violation.layer} extends: ${violation.extends.join(', ')}\n\n`)
}

if (argv.has('--update-baseline')) {
  const written = writeBaseline(violations)
  process.stdout.write(`BASELINE  recorded ${written} known violations from ${checked} checked imports\n`)
  process.exit(0)
}

if (argv.has('--strict') || violations.length === 0) {
  const total = violations.length
  for (const violation of violations) describe(violation)
  process.stdout.write(`${total === 0 ? 'PASS' : 'FAIL'}  ${total} unresolved #layers imports of ${checked} checked\n`)
  process.exit(total === 0 ? 0 : 1)
}

const baseline = readBaseline()
const { added, known } = partition(violations, baseline)
const retired = [...baseline].filter(key => !violations.some(violation => keyOf(violation) === key))

for (const violation of added) describe(violation)
process.stdout.write(`${added.length === 0 ? 'PASS' : 'FAIL'}  ${added.length} new unresolved #layers imports of ${checked} checked\n`)
process.stdout.write(`      ${known.length} known violation(s) tolerated by baseline\n`)
if (retired.length) {
  process.stdout.write(`      ${retired.length} baseline entr(ies) now resolved — run --update-baseline\n`)
}
process.exit(added.length === 0 ? 0 : 1)