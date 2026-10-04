import { test, expect, type Page } from '@playwright/test'
import { createTestUser, loginWith, createActiveBusiness, waitForHydration, type TestUser } from './helpers/e2e-utils'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3000'
const EVIDENCE = '../../.cursor/skills/verify-magicsync/evidence/i18n-locales'

// prefix_except_default: en has no prefix, the others do.
const LOCALES = [
  ['en', ''],
  ['es', '/es'],
  ['de', '/de'],
  ['fr', '/fr'],
] as const

// A raw, unresolved t() key renders as its own dotted path.
const RAW_KEY = /(csvImport|csvUploader|platformSelector|dateRange|common|errors|toast)\.[a-zA-Z0-9.]+/

let user: TestUser

async function bodyText(page: Page) {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ')
}

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(180000)
  const api = await playwright.request.newContext({ baseURL: BASE })
  user = await createTestUser(api)
  await createActiveBusiness(api, user)
})

test('csv import renders translated copy in every locale', async ({ page }) => {
  test.setTimeout(600000)
  mkdirSync(EVIDENCE, { recursive: true })
  await page.context().addCookies([{ ...user.sessionCookie, domain: 'localhost', path: '/' }])

  for (const [locale, prefix] of LOCALES) {
    await page.goto(`${BASE}${prefix}/app/bulk-scheduler/csv-import`)
    await waitForHydration(page)
    await page.waitForTimeout(1500)

    const text = await bodyText(page)
    const raw = text.match(RAW_KEY)
    expect(raw, `${locale}: raw i18n key rendered -> ${raw?.[0]}`).toBeNull()

    // The page title must actually change with the locale.
    await expect(page.getByRole('heading', { name: /CSV/i }).first()).toBeVisible()
    await page.screenshot({ path: `${EVIDENCE}/csv-import-${locale}.png`, fullPage: false })
    console.log(`${locale} csv-import OK :: ${text.slice(0, 90)}`)
  }
})

test('ai tools renders translated copy in every locale', async ({ page }) => {
  test.setTimeout(600000)
  mkdirSync(EVIDENCE, { recursive: true })
  await page.context().addCookies([{ ...user.sessionCookie, domain: 'localhost', path: '/' }])

  const expected: Record<string, string> = {
    en: 'AI Tools',
    es: 'Herramientas de IA',
    de: 'KI-Tools',
    fr: 'Outils IA',
  }

  for (const [locale, prefix] of LOCALES) {
    await page.goto(`${BASE}${prefix}/app/ai-tools/tools`)
    await waitForHydration(page)
    await page.waitForTimeout(1500)

    const text = await bodyText(page)
    const raw = text.match(RAW_KEY)
    expect(raw, `${locale}: raw i18n key rendered -> ${raw?.[0]}`).toBeNull()

    await expect(page.getByRole('heading', { name: expected[locale] })).toBeVisible()
    await page.screenshot({ path: `${EVIDENCE}/ai-tools-${locale}.png`, fullPage: false })
    console.log(`${locale} ai-tools OK :: ${text.slice(0, 90)}`)
  }
})
