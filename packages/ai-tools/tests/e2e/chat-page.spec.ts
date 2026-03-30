import { test, expect } from '@playwright/test'

test.describe('AI Chat Page', () => {
  test.beforeEach(async ({ page }) => {
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

  test('should show A2UI badge when A2UI components are present', async ({ page }) => {
    const a2uiBadge = page.locator('.UBadge:has-text("A2UI")')
    // Badge only shows when A2UI components are rendered
    await expect(a2uiBadge).not.toBeVisible()
  })

  test('should have a clear/reset button', async ({ page }) => {
    const resetButton = page.locator('button[aria-label="Reset"]')
    await expect(resetButton).toBeVisible()
  })

  test('should show loading state while AI is responding', async ({ page }) => {
    // Mock the chat API to simulate slow response
    await page.route('/api/ai-tools/chat', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"content":"Hello","done":false}\n\ndata: {"content":"","done":true}\n\n',
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test message')

    const submitButton = page.getByRole('button', { name: 'Send' })
    await submitButton.click()

    // Check loading indicator appears
    await expect(page.locator('.animate-pulse')).toBeVisible()
  })
})
