#!/usr/bin/env node
/**
 * i18n-audit.mjs — locale parity check for every translation file.
 *
 * A translation file qualifies when ≥2 of its top-level keys are locale codes
 * (en/es/de/fr…). For each file it flattens every locale to dot-paths and
 * reports keys present in one locale but missing in another, plus empty-string
 * leaves (usually untranslated copy-paste).
 *
 * Usage:
 *   node scripts/i18n-audit.mjs            human report, exit 1 on gaps
 *   node scripts/i18n-audit.mjs --json     machine-readable report on stdout
 *   node scripts/i18n-audit.mjs --files a.json,b.json
 *                                          audit only these files
 *
 * Exit codes: 0 = every locale complete, 1 = gaps found, 2 = usage/IO error.
 */
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const LOCALES = ['en', 'es', 'de', 'fr']
const args = process.argv.slice(2)

function usage() {
  console.error('usage: node scripts/i18n-audit.mjs [--json] [--files a.json,b.json]')
  process.exit(2)
}

/** All tracked JSON under packages/, minus manifests that are never locales. */
function discoverFiles() {
  const out = execSync(
    `git ls-files 'packages/**/*.json' | grep -v -e node_modules -e package.json -e tsconfig -e '.nuxt/' -e '/public/'`,
    { encoding: 'utf8' },
  )
  return out.split('\n').map(line => line.trim()).filter(Boolean)
}

/** A locale file has ≥2 locale codes as top-level keys. */
function fileLocales(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  return Object.keys(data).filter(key => LOCALES.includes(key))
}

/** Flatten to dot-paths; arrays expand to indexed paths so length drift shows. */
function flatten(value, prefix, into) {
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, into)
    }
    return into
  }
  into.set(prefix, value)
  return into
}

function auditFile(path) {
  const data = JSON.parse(readFileSync(path, 'utf8'))
  const locales = fileLocales(data)
  if (locales.length < 2) return null

  const keySets = new Map(locales.map(locale => [locale, flatten(data[locale], '', new Map())]))
  const union = new Set()
  for (const keys of keySets.values()) {
    for (const key of keys.keys()) union.add(key)
  }

  const missing = {}
  const empty = {}
  for (const locale of locales) {
    const keys = keySets.get(locale)
    const absent = [...union].filter(key => !keys.has(key)).sort()
    if (absent.length > 0) missing[locale] = absent
    const blank = [...keys.entries()].filter(([, value]) => value === '').map(([key]) => key).sort()
    if (blank.length > 0) empty[locale] = blank
  }

  return { path, locales, totalKeys: union.size, missing, empty }
}

function main() {
  let asJson = false
  let only = null
  for (const arg of args) {
    if (arg === '--json') asJson = true
    else if (arg.startsWith('--files=')) only = arg.slice('--files='.length).split(',').map(s => s.trim()).filter(Boolean)
    else usage()
  }

  const candidates = only ?? discoverFiles()
  const reports = []
  for (const path of candidates) {
    if (!existsSync(path)) {
      console.error(`no such file: ${path}`)
      process.exit(2)
    }
    let report
    try {
      report = auditFile(path)
    } catch (error) {
      console.error(`cannot parse ${path}: ${error.message}`)
      process.exit(2)
    }
    if (report && (Object.keys(report.missing).length > 0 || Object.keys(report.empty).length > 0)) {
      reports.push(report)
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ files: reports }, null, 2))
  } else if (reports.length === 0) {
    console.log(`i18n audit clean — every locale complete across all checked files.`)
  } else {
    const gapCount = reports.reduce(
      (sum, report) => sum + Object.values(report.missing).reduce((n, keys) => n + keys.length, 0),
      0,
    )
    console.log(`i18n audit: ${reports.length} file(s) with gaps, ${gapCount} missing key(s):\n`)
    for (const report of reports) {
      console.log(`${report.path}  [${report.locales.join(', ')} — ${report.totalKeys} keys]`)
      for (const [locale, keys] of Object.entries(report.missing)) {
        console.log(`  ${locale} missing (${keys.length}):`)
        for (const key of keys) console.log(`    - ${key}`)
      }
      for (const [locale, keys] of Object.entries(report.empty)) {
        console.log(`  ${locale} empty (${keys.length}):`)
        for (const key of keys) console.log(`    - ${key}`)
      }
      console.log('')
    }
  }

  process.exit(reports.length > 0 ? 1 : 0)
}

main()
