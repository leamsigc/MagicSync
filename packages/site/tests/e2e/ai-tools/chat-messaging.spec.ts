import { test, expect, type Page } from '@playwright/test'
import { mockAuthSession } from '../fixtures'

function sse(events: Array<Record<string, unknown>>) {
  return events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('')
}

async function mockBusinessAndThreads(page: Page) {
  await page.route('**/api/v1/business', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 'biz-1', name: 'Test Bakery' }] }),
    })
  })
  await page.route('**/api/ai-tools/chat/threads', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
}

test.describe('Chat Messaging', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
    await mockBusinessAndThreads(page)
    await page.goto('/app/chat')
  })

  test('should send a message and display user message', async ({ page }) => {
    await page.route('**/api/v1/agent/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse([
          { type: 'text.delta', id: 's:1', delta: 'Hello! ' },
          { type: 'message.completed', id: 's:2', sessionId: 'x', threadId: 't-1', content: 'Hello!' },
        ]),
      })
    })

    const chatInput = page.getByPlaceholder('Tell me what you need...')
    await chatInput.fill('Hello AI')
    await chatInput.press('Enter')

    await expect(page.getByText('Hello AI').first()).toBeVisible()
  })

  test('should stream the assistant response after sending', async ({ page }) => {
    await page.route('**/api/v1/agent/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse([
          { type: 'text.delta', id: 's:1', delta: 'Hi there! ' },
          { type: 'text.delta', id: 's:2', delta: 'How can I help?' },
          { type: 'message.completed', id: 's:3', sessionId: 'x', threadId: 't-1', content: 'Hi there! How can I help?' },
        ]),
      })
    })

    await page.getByPlaceholder('Tell me what you need...').fill('Hello')
    await page.getByPlaceholder('Tell me what you need...').press('Enter')

    await expect(page.getByText('Hi there! How can I help?')).toBeVisible({ timeout: 10000 })
  })

  test('should show the tool step badge when the agent uses a tool', async ({ page }) => {
    await page.route('**/api/v1/agent/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse([
          { type: 'tool.started', id: 's:1', toolCallId: 'tool-1', toolName: 'execute_goal', args: {} },
          { type: 'tool.finished', id: 's:2', toolCallId: 'tool-1', toolName: 'execute_goal', isError: false, result: 'done' },
          { type: 'text.delta', id: 's:3', delta: 'Working on it.' },
          { type: 'message.completed', id: 's:4', sessionId: 'x', threadId: 't-1', content: 'Working on it.' },
        ]),
      })
    })

    await page.getByPlaceholder('Tell me what you need...').fill('Help me get more customers.')
    await page.getByPlaceholder('Tell me what you need...').press('Enter')

    await expect(page.getByText('Execute goal')).toBeVisible({ timeout: 10000 })
  })

  test('should surface API errors inside the conversation', async ({ page }) => {
    await page.route('**/api/v1/agent/chat', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })

    await page.getByPlaceholder('Tell me what you need...').fill('Test message')
    await page.getByPlaceholder('Tell me what you need...').press('Enter')

    await expect(page.getByText('No response received. Please try again.')).toBeVisible({ timeout: 10000 })
  })

  test('should clear messages when starting a new chat', async ({ page }) => {
    await page.route('**/api/v1/agent/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse([
          { type: 'text.delta', id: 's:1', delta: 'Response' },
          { type: 'message.completed', id: 's:2', sessionId: 'x', threadId: 't-1', content: 'Response' },
        ]),
      })
    })

    await page.getByPlaceholder('Tell me what you need...').fill('Test')
    await page.getByPlaceholder('Tell me what you need...').press('Enter')
    await expect(page.getByText('Response')).toBeVisible()

    await page.getByRole('button', { name: 'New chat' }).click()

    await expect(page.getByText('Test')).not.toBeVisible()
    await expect(page.getByText('Response')).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'What do you need help with?' })).toBeVisible()
  })

  test('should send the suggestion text when clicking a suggestion', async ({ page }) => {
    await page.route('**/api/v1/agent/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse([
          { type: 'text.delta', id: 's:1', delta: 'Creating post...' },
          { type: 'message.completed', id: 's:2', sessionId: 'x', threadId: 't-1', content: 'Creating post...' },
        ]),
      })
    })

    await page.getByRole('button', { name: 'Make me a great post for Facebook.' }).click()

    await expect(page.getByText('Make me a great post for Facebook.').first()).toBeVisible()
  })

  test('should send the selected agent, tools and skills with the message', async ({ page }) => {
    await page.route('**/api/v1/agent/capabilities?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agents: [{ name: 'writer', description: 'Writes drafts.', tools: ['write_post', 'retrieve'] }],
          tools: [
            { name: 'write_post', group: 'content', description: 'Draft a post.' },
            { name: 'retrieve', group: 'research', description: 'Search knowledge.' },
          ],
          skills: {
            bundled: [{ slug: 'content-writer', name: 'content-writer', description: 'Write posts.', scope: 'global' }],
            registered: [],
          },
        }),
      })
    })
    let requestBody: Record<string, unknown> | null = null
    await page.route('**/api/v1/agent/chat', async (route) => {
      requestBody = await route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse([
          { type: 'text.delta', id: 's:1', delta: 'Draft ready.' },
          { type: 'message.completed', id: 's:2', sessionId: 'x', threadId: 't-1', content: 'Draft ready.' },
        ]),
      })
    })

    await page.goto('/app/chat')
    await page.getByRole('button', { name: 'Options' }).click()
    await page.locator('footer').getByRole('button', { name: 'Show popup' }).click()
    await page.getByRole('option', { name: 'Writer' }).click()
    await page.getByRole('checkbox', { name: 'retrieve' }).click()
    await page.getByRole('checkbox', { name: 'content-writer' }).click()
    await page.getByPlaceholder('Tell me what you need...').fill('Write a tip.')
    await page.getByPlaceholder('Tell me what you need...').press('Enter')
    await expect(page.getByText('Draft ready.')).toBeVisible({ timeout: 10000 })

    expect(requestBody).toMatchObject({
      agentName: 'writer',
      allowedTools: ['write_post'],
      skillSlugs: ['content-writer'],
    })
  })

  test('should expand a tool row to show its output', async ({ page }) => {
    await page.route('**/api/v1/agent/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse([
          { type: 'tool.started', id: 's:1', toolCallId: 'tool-1', toolName: 'execute_goal', args: {} },
          { type: 'tool.finished', id: 's:2', toolCallId: 'tool-1', toolName: 'execute_goal', isError: false, result: 'goal-output-123' },
          { type: 'text.delta', id: 's:3', delta: 'Done.' },
          { type: 'message.completed', id: 's:4', sessionId: 'x', threadId: 't-1', content: 'Done.' },
        ]),
      })
    })

    await page.getByPlaceholder('Tell me what you need...').fill('Help me get more customers.')
    await page.getByPlaceholder('Tell me what you need...').press('Enter')
    await expect(page.getByText('Execute goal')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Execute goal' }).click()
    await expect(page.getByText('goal-output-123')).toBeVisible()
  })
})
