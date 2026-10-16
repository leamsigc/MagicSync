/**
 * Capture the step-by-step interactions of each feature.
 *
 * Runs every registered journey in `journeys/index.ts`. Each journey walks one
 * route's interactions in order and writes one numbered image per step into that
 * route's folder:
 *
 *   packages/doc/public/img/screenshots/<route-slug>/NN-<step>.png
 *
 * Re-running replaces each step in place. `interactions.json` records, per
 * journey, the captured steps, the preconditions it required, the interactions it
 * deliberately skipped, and any declared step that was missed.
 *
 *   pnpm screenshots:interactions
 *   SCREENSHOT_FEATURE=content-board pnpm screenshots:interactions
 *
 * Journeys are authored, not auto-discovered: only a written drive knows what an
 * interaction is supposed to produce. See
 * `packages/doc/skills/capture-feature-interactions/SKILL.md`.
 */
import { expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createActiveBusiness, createTestUser, loginWith } from '../e2e/helpers/e2e-utils'
import { journey, SCREENSHOT_ROOT } from '../e2e/helpers/route-screenshots'
import { journeys, type JourneyDefinition } from './journeys/index'

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000'

interface JourneyResult {
  key: string
  title: string
  route: string
  ok: boolean
  expected: number
  captured: string[]
  /** Declared step IDs that no captured path accounted for. */
  missing: string[]
  preconditions: string[]
  notCovered: string[]
  error?: string
}

async function runJourney(
  def: JourneyDefinition,
  ctx: Omit<Parameters<JourneyDefinition['run']>[0], 'journey'>,
): Promise<JourneyResult> {
  // The handle is created here, not inside `run`, so a mid-journey failure still
  // reports the steps that did capture.
  const handle = journey(ctx.page, { route: def.route })
  const base = {
    key: def.key,
    title: def.title,
    route: def.route,
    expected: def.steps.length,
    preconditions: def.preconditions,
    notCovered: def.notCovered ?? [],
  }
  const missingFor = (captured: string[]): string[] =>
    def.steps.filter((id) => !captured.some((path) => path.includes(id)))

  try {
    await def.setup?.({ ...ctx, journey: handle })
    await def.run({ ...ctx, journey: handle })
    const missing = missingFor(handle.captured)
    return { ...base, ok: missing.length === 0, captured: handle.captured, missing }
  } catch (error) {
    return {
      ...base,
      ok: false,
      captured: handle.captured,
      missing: missingFor(handle.captured),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Human-readable transcript of one journey, for the console. */
function describe(def: JourneyDefinition, result: JourneyResult): string[] {
  const lines = [`   needs: ${def.preconditions.join(' | ') || 'nothing beyond the fixtures'}`]
  for (const path of result.captured) lines.push(`   ok  ${path}`)
  if (result.error) lines.push(`   FAIL ${result.error}`)
  if (result.missing.length > 0) lines.push(`   missing steps: ${result.missing.join(', ')}`)
  for (const gap of result.notCovered) lines.push(`   not covered: ${gap}`)
  return lines
}

test('capture each feature interaction step by step', async ({ page, playwright }) => {
  test.setTimeout(0) // a journey drives real interactions; the work is the timeout

  const only = process.env.SCREENSHOT_FEATURE
  const selected = only ? journeys.filter((def) => def.key === only) : journeys
  if (selected.length === 0) {
    const known = journeys.map((def) => def.key).join(', ') || '(none registered)'
    throw new Error(`No journey matched SCREENSHOT_FEATURE=${only}. Known journeys: ${known}`)
  }

  const authed = await playwright.request.newContext({ baseURL: BASE_URL })
  const user = await createTestUser(authed)
  await loginWith(page, user)
  const business = await createActiveBusiness(authed, user)

  const results: JourneyResult[] = []
  for (const def of selected) {
    const result = await runJourney(def, { page, authed, user, business, baseURL: BASE_URL })
    results.push(result)
    process.stdout.write(`\n== ${def.key} — ${def.title}\n${describe(def, result).join('\n')}\n`)
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    total: results.length,
    passed: results.filter((result) => result.ok).length,
    journeys: results,
  }
  const file = join(SCREENSHOT_ROOT, 'interactions.json')
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)

  const failed = results.filter((result) => !result.ok)
  process.stdout.write(
    `\ncaptured ${results.length - failed.length}/${results.length} journeys -> ${file}\n`,
  )
  expect(failed.map((result) => result.key), 'journeys that failed or missed steps').toEqual([])
})
