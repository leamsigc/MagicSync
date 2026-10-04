import type { Page } from '@playwright/test'
import { test, expect, mockThreads } from './fixtures'
import { createTestUser, createActiveBusiness, loginWith, blockHeavyAssets, waitForHydration, type TestUser } from './helpers/e2e-utils'

/**
 * T23 RunCard verification: one compact card per capability run — header,
 * real-status step rail, typed sections, approval path — driven by a scripted
 * five-tool SSE run (no network, no model).
 */

let user: TestUser

test.beforeAll(async ({ request }) => {
  test.setTimeout(120000)
  user = await createTestUser(request)
  await createActiveBusiness(request, user)
})

function sseLine(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

function toolTurn(callId: string, toolName: string, result: unknown): string {
  return (
    sseLine({ type: 'tool.started', id: `started-${callId}`, toolCallId: callId, toolName, args: {} })
    + sseLine({ type: 'tool.finished', id: `finished-${callId}`, toolCallId: callId, toolName, isError: false, result: JSON.stringify(result) })
  )
}

const CAROUSEL_RESULT = {
  slides: [
    { id: 's1', headline: 'Hook your scrollers', body: 'First slide body' },
    { id: 's2', headline: 'Keep them watching', body: 'Second slide body' },
  ],
  caption: 'Post this carousel today',
  research: { brief: 'Carousel angles that convert', citations: [{ label: 'Trend report' }], sourcesUsed: 1 },
  artifactId: 'artifact-1',
  version: 1,
  platform: 'instagram',
}

const FIVE_TOOL_RUN = (
  sseLine({ type: 'message.started', id: 'm:1', sessionId: 'run-card-session' })
  + toolTurn('c1', 'research_topic', { brief: 'Roofing angles that convert', results: [{ title: 'Angle one', text: 'Details here' }] })
  + toolTurn('c2', 'write_post', { caption: 'Fresh roof, fresh start' })
  + toolTurn('c3', 'board_add_cards', { cards: [{ id: 'card-1', title: 'Roof idea', brief: 'Fix it', state: 'idea' }] })
  + toolTurn('c4', 'create_carousel', CAROUSEL_RESULT)
  + toolTurn('c5', 'schedule_post', { status: 'queued' })
  + sseLine({ type: 'text.delta', id: 'm:2', delta: 'Done. ' })
  + sseLine({ type: 'message.completed', id: 'm:3', sessionId: 'run-card-session', threadId: 'new-thread-id', content: 'Done.' })
)

async function mockFiveToolRun(page: Page): Promise<void> {
  await page.route('**/api/v1/agent/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'X-Thread-Id': 'new-thread-id' },
      body: FIVE_TOOL_RUN,
    })
  })
}

async function sendRun(page: Page): Promise<void> {
  const chatInput = page.getByPlaceholder('Tell me what you need...')
  await chatInput.fill('Show me the roofing plan')
  await chatInput.press('Enter')
}

test.describe('RunCard - one card per run (T23)', () => {
  test('renders exactly one card with a real-status rail and typed sections', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await mockThreads(page, [])
    await mockFiveToolRun(page)
    await page.goto('/app/chat')
    await waitForHydration(page)
    await sendRun(page)

    const card = page.getByTestId('run-card')
    await expect(card).toHaveCount(1, { timeout: 15000 })

    const steps = card.getByTestId('run-step')
    await expect(steps).toHaveCount(5)
    await expect(steps.filter({ hasText: 'Research topic' })).toHaveCount(1)

    await expect(card.getByTestId('run-section').filter({ has: page.getByText('Roofing angles that convert') })).toHaveCount(1)
    await expect(card.getByText('Fresh roof, fresh start')).toBeVisible()
    await expect(card.getByText('Roof idea')).toBeVisible()
    await expect(card.getByText('Hook your scrollers')).toBeVisible()
    await expect(card.getByText('Keep them watching')).toBeVisible()

    await expect(card.getByRole('button', { name: /approve carousel/i })).toBeVisible()
  })

  test('matches the compact workflow card in dark and light', async ({ page }) => {
    await blockHeavyAssets(page)
    await loginWith(page, user)
    await mockThreads(page, [])
    await mockFiveToolRun(page)
    await page.goto('/app/chat')
    await waitForHydration(page)
    await sendRun(page)

    const card = page.getByTestId('run-card')
    await expect(card).toHaveCount(1, { timeout: 15000 })
    await expect(card.getByText('Hook your scrollers')).toBeVisible()
    await card.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'test-results/runcard-dark.png', animations: 'disabled' })

    await page.emulateMedia({ colorScheme: 'light' })
    await card.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'test-results/runcard-light.png', animations: 'disabled' })
  })
})
