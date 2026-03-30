import { test, expect, mockChatAPI, mockThreadsList } from './fixtures'

test.describe('Chat Threads', () => {
  test('should display thread list in sidebar', async ({ authPage: page }) => {
    await mockChatAPI(page)
    await mockThreadsList(page, [
      { id: 't1', title: 'Marketing strategy', lastMessageAt: new Date().toISOString() },
      { id: 't2', title: 'Post ideas', lastMessageAt: new Date().toISOString() },
    ])
    await page.goto('/app/ai-tools/chat')

    await expect(page.getByText('Marketing strategy')).toBeVisible()
    await expect(page.getByText('Post ideas')).toBeVisible()
  })

  test('should show empty state when no threads', async ({ authPage: page }) => {
    await mockChatAPI(page)
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    await expect(page.getByText('No conversations yet')).toBeVisible()
  })

  test('should have new chat button', async ({ authPage: page }) => {
    await mockChatAPI(page)
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    await expect(page.getByRole('button', { name: 'New Chat' })).toBeVisible()
  })

  test('should clear messages when clicking new chat', async ({ authPage: page }) => {
    await mockChatAPI(page, 'Test response')
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    // Send a message
    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Hello')
    await chatInput.press('Enter')

    await expect(page.getByText('Test response')).toBeVisible()

    // Click new chat
    await page.getByRole('button', { name: 'New Chat' }).click()

    // Messages should be cleared
    await expect(page.getByText('Hello')).not.toBeVisible()
    await expect(page.getByText('Welcome to MagicSync AI')).toBeVisible()
  })
})

test.describe('Chat Messaging Flow', () => {
  test('should send message and display user bubble', async ({ authPage: page }) => {
    await mockChatAPI(page, 'Hello there!')
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('What is my schedule today?')
    await chatInput.press('Enter')

    // User message appears as a bubble
    await expect(page.getByText('What is my schedule today?').first()).toBeVisible()
  })

  test('should display streaming AI response', async ({ authPage: page }) => {
    await mockChatAPI(page, 'Your schedule includes three posts')
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('What is my schedule today?')
    await chatInput.press('Enter')

    // AI response appears
    await expect(page.getByText(/Your schedule includes three posts/)).toBeVisible({ timeout: 10000 })
  })

  test('should show AI avatar next to assistant messages', async ({ authPage: page }) => {
    await mockChatAPI(page, 'Response')
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test')
    await chatInput.press('Enter')

    // Assistant message area should have avatar
    await expect(page.locator('i-heroicons-sparkles').nth(1)).toBeVisible()
  })

  test('should handle API error gracefully', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/chat', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test')
    await chatInput.press('Enter')

    await expect(page.getByText('Something went wrong')).toBeVisible()
  })

  test('should handle network failure', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/chat', async (route) => {
      await route.abort('failed')
    })
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test')
    await chatInput.press('Enter')

    await expect(page.getByText('Something went wrong')).toBeVisible()
  })
})

test.describe('Chat Suggestions', () => {
  test('should show suggestion buttons in empty state', async ({ authPage: page }) => {
    await mockChatAPI(page)
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    await expect(page.getByRole('button', { name: 'Create a post for Twitter' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Analyze my target audience' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Research trending topics' })).toBeVisible()
  })

  test('should send message when clicking suggestion', async ({ authPage: page }) => {
    await mockChatAPI(page, 'Creating your Twitter post...')
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    await page.getByRole('button', { name: 'Create a post for Twitter' }).click()

    await expect(page.getByText('Create a post for Twitter').first()).toBeVisible()
    await expect(page.getByText(/Creating your Twitter post/)).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Chat Input', () => {
  test('should allow typing in input', async ({ authPage: page }) => {
    await mockChatAPI(page)
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Hello AI')
    await expect(chatInput).toHaveValue('Hello AI')
  })

  test('should clear input after sending', async ({ authPage: page }) => {
    await mockChatAPI(page)
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test message')
    await chatInput.press('Enter')

    await expect(chatInput).toHaveValue('')
  })

  test('should have correct placeholder text', async ({ authPage: page }) => {
    await mockChatAPI(page)
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    await expect(
      page.getByPlaceholder('Ask me anything about your social media strategy...')
    ).toBeVisible()
  })
})

test.describe('Chat Header', () => {
  test('should show assistant title', async ({ authPage: page }) => {
    await mockChatAPI(page)
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    await expect(page.locator('h1')).toContainText('MagicSync AI Assistant')
  })

  test('should show ready status', async ({ authPage: page }) => {
    await mockChatAPI(page)
    await mockThreadsList(page, [])
    await page.goto('/app/ai-tools/chat')

    await expect(page.getByText('Ready')).toBeVisible()
  })
})
