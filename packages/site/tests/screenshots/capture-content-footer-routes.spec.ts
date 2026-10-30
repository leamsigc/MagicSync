import { expect, test } from '@playwright/test'
import { captureRouteAction } from '../e2e/helpers/route-screenshots'

/**
 * One-off capture for the newly authored multilingual content routes and the
 * SEO footer blocks. Content pages are not part of the nuxt-link-checker route
 * manifest (they resolve through the content catch-all), so the regular sweep
 * cannot reach them.
 */
const ROUTES = [
  '/?capture=1',
  '/es?capture=1',
  '/de?capture=1',
  '/fr?capture=1',
  '/for',
  '/es/for',
  '/de/for',
  '/fr/for',
  '/platform',
  '/es/platform',
  '/de/platform',
  '/fr/platform',
  '/platform/facebook',
  '/es/platform/facebook',
  '/de/platform/facebook',
  '/fr/platform/facebook',
  '/pricing',
  '/es/pricing',
  '/de/pricing',
  '/fr/pricing',
]

test('capture multilingual content routes and footer', async ({ page }) => {
  test.setTimeout(0)
  for (const route of ROUTES) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    expect(response?.status(), route).toBe(200)
    // Hydration attaches the motion observers; scrolling before that does
    // nothing. Wait for the app, then walk the page to trigger every reveal.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await page.waitForTimeout(1_000)
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y)
        await new Promise(resolve => setTimeout(resolve, 120))
      }
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(600)
    // Motion reveals that never intersected stay at the SSR opacity:0 baseline.
    // Screenshots should show the finished page, so force those wrappers open.
    await page.addStyleTag({ content: '[style*="opacity:0"], [style*="opacity: 0"] { opacity: 1 !important; }' })
    const shot = await captureRouteAction(page, { route, action: 'page' })
    process.stdout.write(`ok ${route} -> ${shot.relativePath}\n`)
    if (route.endsWith('/pricing')) {
      await page.setViewportSize({ width: 1440, height: 2000 })
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(300)
      const footerShot = await captureRouteAction(page, { route, action: 'seo-footer', fullPage: false })
      process.stdout.write(`ok ${route} -> ${footerShot.relativePath}\n`)
    }
  }
})

test('capture MagicImageGallery preview and lightbox', async ({ page }) => {
  test.setTimeout(0)
  const route = '/ui-preview/MagicImageGallery'
  const response = await page.goto(route, { waitUntil: 'networkidle', timeout: 90_000 })
  expect(response?.status(), route).toBe(200)
  await page.waitForTimeout(1_000)

  const gridShot = await captureRouteAction(page, { route, action: 'page' })
  process.stdout.write(`ok ${route} -> ${gridShot.relativePath}\n`)

  await page.locator('section[aria-label] ul > li > button').first().click()
  await page.waitForTimeout(500)
  const lightboxShot = await captureRouteAction(page, { route, action: 'lightbox', fullPage: false })
  process.stdout.write(`ok ${route} -> ${lightboxShot.relativePath}\n`)
})
