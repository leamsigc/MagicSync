import { test, expect } from '@playwright/test'

test.describe('Chat Messaging', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/ai-tools/chat')
  })

  test('should send a message and display user message', async ({ page }) => {
    // Mock the chat API
    await page.route('/api/v1/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"content":"Hello!","done":false}\n\ndata: {"content":"","done":true}\n\n',
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Hello AI')
    await chatInput.press('Enter')

    // Check user message appears
    await expect(page.getByText('Hello AI').first()).toBeVisible()
  })

  test('should display AI response after sending', async ({ page }) => {
    // Mock the chat API with streaming response
    await page.route('/api/v1/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"content":"Hi there!","done":false}\n\ndata: {"content":" How can I help?","done":false}\n\ndata: {"content":"","done":true}\n\n',
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Hello')
    await chatInput.press('Enter')

    // Wait for AI response
    await expect(page.getByText('Hi there! How can I help?')).toBeVisible({ timeout: 10000 })
  })

  test('should handle API error gracefully', async ({ page }) => {
    // Mock the chat API to return an error
    await page.route('/api/v1/chat', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test message')
    await chatInput.press('Enter')

    // Check error message appears
    await expect(page.getByText('Something went wrong')).toBeVisible()
  })

  test('should clear messages when clicking new chat', async ({ page }) => {
    // Mock the chat API
    await page.route('/api/v1/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"content":"Response","done":false}\n\ndata: {"content":"","done":true}\n\n',
      })
    })

    // Send a message
    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test')
    await chatInput.press('Enter')

    // Wait for message
    await expect(page.getByText('Response')).toBeVisible()

    // Click new chat
    await page.getByRole('button', { name: 'New Chat' }).click()

    // Check messages are cleared
    await expect(page.getByText('Test')).not.toBeVisible()
    await expect(page.getByText('Response')).not.toBeVisible()
    await expect(page.getByText('Welcome to MagicSync AI')).toBeVisible()
  })

  test('should use suggestion button to send message', async ({ page }) => {
    // Mock the chat API
    await page.route('/api/v1/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"content":"Creating post...","done":false}\n\ndata: {"content":"","done":true}\n\n',
      })
    })

    await page.getByRole('button', { name: 'Create a post for Twitter' }).click()

    // Check the suggestion message was sent
    await expect(page.getByText('Create a post for Twitter').first()).toBeVisible()
  })

  test('should show error when network fails', async ({ page }) => {
    // Mock network failure
    await page.route('/api/v1/chat', async (route) => {
      await route.abort('failed')
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test')
    await chatInput.press('Enter')

    // Check error state
    await expect(page.getByText('Something went wrong')).toBeVisible()
  })
})
