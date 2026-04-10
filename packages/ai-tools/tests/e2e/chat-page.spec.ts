import { test, expect } from '@playwright/test'
import { mockAuthSession } from './fixtures'

test.describe('AI Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
    await page.goto('/app/ai-tools/chat')
  })

  test('should display the chat page with welcome message', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('MagicSync AI Assistant')
    await expect(page.getByText('Welcome to MagicSync AI')).toBeVisible()
  })

  test('should show suggestion buttons when chat is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Create a post for Twitter' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Analyze my target audience' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Research trending topics' })).toBeVisible()
  })

  test('should show chat sidebar with new chat button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'New Chat' })).toBeVisible()
  })

  test('should show empty state for threads', async ({ page }) => {
    await expect(page.getByText('No conversations yet')).toBeVisible()
  })

  test('should allow typing in the chat input', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Hello AI')
    await expect(chatInput).toHaveValue('Hello AI')
  })

  test('should disable submit when input is empty', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: 'Send' })
    await expect(submitButton).toBeDisabled()
  })

  test('should enable submit when input has text', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Hello AI')
    const submitButton = page.getByRole('button', { name: 'Send' })
    await expect(submitButton).toBeEnabled()
  })

  test('should show loading state while AI is responding', async ({ page }) => {
    // Mock the chat API to simulate slow response
    await page.route('/api/ai-tools/chat', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"text","content":"Hello","done":false}\n\ndata: {"type":"finish","finishReason":"stop"}\n\n',
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test message')

    const submitButton = page.getByRole('button', { name: 'Send' })
    await submitButton.click()

    // Check loading indicator appears
    await expect(page.locator('.animate-bounce')).toBeVisible()
  })

  test('should send message on Enter key', async ({ page }) => {
    await page.route('/api/ai-tools/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"text","content":"Response","done":false}\n\ndata: {"type":"finish","finishReason":"stop"}\n\n',
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test')
    await chatInput.press('Enter')

    await expect(page.getByText('Test')).toBeVisible()
    await expect(page.getByText('Response')).toBeVisible({ timeout: 10000 })
  })

  test('should show thinking indicator during reasoning', async ({ page }) => {
    await page.route('/api/ai-tools/chat', async (route) => {
      const chunks = [
        { type: 'thinking', content: 'Analyzing...' },
        { type: 'text', content: 'Answer here', done: false },
        { type: 'finish', finishReason: 'stop' },
      ]
      const body = chunks.map(c => `data: ${JSON.stringify(c)}\n\n`).join('')
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body,
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Complex question')
    await chatInput.press('Enter')

    await expect(page.getByText('Reasoning')).toBeVisible({ timeout: 10000 })
  })

  test('should handle API error gracefully', async ({ page }) => {
    await page.route('/api/ai-tools/chat', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test')
    await chatInput.press('Enter')

    // Should show error state without crashing
    await expect(page.getByPlaceholder('Ask me anything about your social media strategy...')).toBeVisible()
  })
})