import { chromium } from 'playwright'
import { createClient } from '@libsql/client'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = 'http://localhost:3000'
const suffix = `${Date.now()}`
const email = `e2e-${suffix}@test.magicsync.dev`
const password = `TestPass${suffix}!aA1`
const MODEL_ID = 'prism-ml/Ternary-Bonsai-2-27B-gguf:Q2_0'
const BASE_URL = 'http://localhost:8888/v1'

// Directly verify the email in the local dev DB (same approach as e2e-utils)
const env = readFileSync(new URL('../../../../.env', import.meta.url).pathname, 'utf8')
const read = (key) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1].trim()
const db = createClient({ url: read('NUXT_TURSO_DATABASE_URL'), authToken: read('NUXT_TURSO_AUTH_TOKEN') })

const ctx = await chromium.launch({ headless: true }).then(b => b.newContext({ viewport: { width: 1440, height: 900 } }))

// 1. Sign up + sign in through the real API, capture session cookie
const signUp = await ctx.request.post(`${BASE}/api/auth/sign-up/email`, {
  data: { name: 'E2E Llama', firstName: 'E2E', lastName: 'Llama', email, password },
})
if (!signUp.ok()) throw new Error(`signup ${signUp.status()}: ${await signUp.text()}`)
const { user: created } = await signUp.json()
await db.execute({ sql: 'UPDATE user SET email_verified = 1 WHERE id = ?', args: [created.id] })
console.log('EMAIL VERIFIED IN DB')

const signIn = await ctx.request.post(`${BASE}/api/auth/sign-in/email`, {
  data: { email, password },
})
if (!signIn.ok()) throw new Error(`signin ${signIn.status()}: ${await signIn.text()}`)
const setCookie = signIn.headersArray().find(h => h.name.toLowerCase() === 'set-cookie')
const raw = setCookie.value.split(';')[0]
const eq = raw.indexOf('=')
await ctx.addCookies([{ name: raw.slice(0, eq), value: raw.slice(eq + 1), domain: 'localhost', path: '/' }])
console.log('AUTH: ok as', email)

const page = await ctx.newPage()

// 2. Open /app/account
await page.goto(`${BASE}/app/account`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(2000)
console.log('URL:', page.url())
await page.screenshot({ path: '/tmp/llama-1-account.png' })

// 3. Locate the AI Model card controls
const card = page.locator('div').filter({ has: page.getByRole('heading', { name: /AI Model/i }) }).last()
const providerSelect = card.locator('select').first()
const testButton = card.getByRole('button', { name: /test connection/i })

console.log('provider select count:', await providerSelect.count())
console.log('test button count:', await testButton.count())

// 4. Select the llama provider
const selectVisible = await providerSelect.isVisible().catch(() => false)
if (selectVisible) {
  const options = await providerSelect.locator('option').allTextContents()
  console.log('PROVIDER OPTIONS:', JSON.stringify(options))
  const llamaValue = await providerSelect.locator('option', { hasText: /llama cpp|llama\.cpp/i }).getAttribute('value')
  console.log('LLAMA OPTION VALUE:', llamaValue)
  await providerSelect.selectOption(llamaValue)
  await page.waitForTimeout(800)
} else {
  // Nuxt UI USelect renders a button + listbox
  console.log('native select not found, trying USelect button…')
  const providerBtn = card.getByRole('combobox').first()
  await providerBtn.click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/llama-2-provider-open.png' })
  const opt = page.getByRole('option', { name: /llama cpp|llama\.cpp/i }).first()
  await opt.click()
  await page.waitForTimeout(800)
}

await page.screenshot({ path: '/tmp/llama-3-after-provider.png' })

// 5. Base URL field should now be visible (llama is a local provider)
const baseUrlInput = page.locator('input[name="apiBaseUrl"], input[placeholder*="8888"], input[placeholder*="11434"]').first()
console.log('base url visible:', await baseUrlInput.isVisible().catch(() => false))
if (await baseUrlInput.isVisible().catch(() => false)) {
  await baseUrlInput.fill(BASE_URL)
}

// 6. Model: pick the preset from the model select
const modelSelect = page.locator('select').nth(1)
if (await modelSelect.isVisible().catch(() => false)) {
  const modelOptions = await modelSelect.locator('option').allTextContents()
  console.log('MODEL OPTIONS:', JSON.stringify(modelOptions))
} else {
  const modelBtn = page.getByRole('combobox').nth(1)
  await modelBtn.click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/llama-4-model-open.png' })
  const modelOpt = page.getByRole('option', { name: /Ternary-Bonsai/i }).first()
  await modelOpt.click()
}

await page.screenshot({ path: '/tmp/llama-5-filled.png' })

// 7. Click Test connection and capture the network response
const respPromise = page.waitForResponse(r => r.url().includes('/api/v1/llm/test'), { timeout: 60000 })
await testButton.click()
const resp = await respPromise
const respBody = await resp.json().catch(() => null)
console.log('TEST RESPONSE STATUS:', resp.status())
console.log('TEST RESPONSE BODY:', JSON.stringify(respBody))

await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/llama-6-after-test.png' })

// 8. Read the toast / visible feedback
const toastText = await page.evaluate(() => {
  const toasts = document.querySelectorAll('[data-sonner-toast], [role="status"], .toast, [data-toast]')
  return Array.from(toasts).map(t => t.textContent?.trim()).filter(Boolean)
})
console.log('TOASTS:', JSON.stringify(toastText))

await ctx.browser().close()
console.log('DONE')
