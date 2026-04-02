import { test, expect, mockChatSSE, mockThreads } from './fixtures'

test.describe('AI Chat Page - Site Integration', () => {
  test.describe('Page Structure', () => {
    test('should render the chat page with AiToolsLayout (no dashboard sidebar)', async ({ authPage: page }) => {
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')

      // Should have the AiToolsLayout top bar, not the dashboard sidebar
      await expect(page.locator('header')).toContainText('MagicSync')

      // Should NOT have dashboard sidebar
      await expect(page.locator('[class*="UDashboardSidebar"]')).not.toBeVisible()
    })

    test('should display the chat header with title', async ({ authPage: page }) => {
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')

      await expect(page.locator('h1')).toContainText('MagicSync AI Assistant')
    })

    test('should show dark background matching DESIGN.md', async ({ authPage: page }) => {
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')

      const chatContainer = page.locator('.bg-\\[\\#0a0a0a\\]')
      await expect(chatContainer).toBeVisible()
    })

    test('should show welcome state when no messages', async ({ authPage: page }) => {
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')

      await expect(page.getByText('Welcome to MagicSync AI')).toBeVisible()
      await expect(page.getByText(/I can help you create posts/)).toBeVisible()
    })

    test('should display three suggestion buttons', async ({ authPage: page }) => {
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')

      await expect(page.getByRole('button', { name: 'Create a post for Twitter' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Analyze my target audience' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Research trending topics' })).toBeVisible()
    })
  })

  test.describe('Chat Sidebar', () => {
    test('should show new chat button', async ({ authPage: page }) => {
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')

      await expect(page.getByRole('button', { name: 'New Chat' })).toBeVisible()
    })

    test('should show empty state when no threads', async ({ authPage: page }) => {
      await mockThreads(page, [])
      await page.goto('/app/ai-tools/chat')

      await expect(page.getByText('No conversations yet')).toBeVisible()
    })

    test('should list existing threads', async ({ authPage: page }) => {
      await mockThreads(page, [
        { id: 't1', title: 'Marketing strategy', lastMessageAt: new Date().toISOString() },
        { id: 't2', title: 'Post ideas', lastMessageAt: new Date().toISOString() },
      ])
      await page.goto('/app/ai-tools/chat')

      await expect(page.getByText('Marketing strategy')).toBeVisible()
      await expect(page.getByText('Post ideas')).toBeVisible()
    })
  })

  test.describe('Chat Messaging', () => {
    test('should send a message and display user bubble', async ({ authPage: page }) => {
      await mockThreads(page, [])
      await mockChatSSE(page, 'Hello there!')
      await page.goto('/app/ai-tools/chat')

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('What is my schedule today?')
      await chatInput.press('Enter')

      await expect(page.getByText('What is my schedule today?').first()).toBeVisible()
    })

    test('should display streaming AI response', async ({ authPage: page }) => {
      await mockThreads(page, [])
      await mockChatSSE(page, 'Your schedule includes three posts today')
      await page.goto('/app/ai-tools/chat')

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('What is my schedule?')
      await chatInput.press('Enter')

      await expect(page.getByText(/Your schedule includes three posts/)).toBeVisible({ timeout: 10000 })
    })

    test('should show thinking indicator while AI processes', async ({ authPage: page }) => {
      await mockThreads(page, [])
      // Delay the response to capture the thinking state
      await page.route('**/api/ai-tools/chat', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'data: {"content":"Response","done":false}\n\ndata: {"content":"","done":true}\n\n',
        })
      })
      await page.goto('/app/ai-tools/chat')

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Hello')
      await chatInput.press('Enter')

      // Thinking indicator should briefly appear
      await expect(page.getByText('Thinking...')).toBeVisible({ timeout: 3000 })
    })

    test('should show emerald accent on AI avatar', async ({ authPage: page }) => {
      await mockThreads(page, [])
      await mockChatSSE(page, 'Response text')
      await page.goto('/app/ai-tools/chat')

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Test')
      await chatInput.press('Enter')

      await expect(page.getByText('Response text')).toBeVisible({ timeout: 10000 })

      // AI avatar should use emerald accent
      const avatar = page.locator('.bg-emerald-500\\/10').first()
      await expect(avatar).toBeVisible()
    })

    test('should clear input after sending', async ({ authPage: page }) => {
      await mockThreads(page, [])
      await mockChatSSE(page, 'Response')
      await page.goto('/app/ai-tools/chat')

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Test message')
      await chatInput.press('Enter')

      await expect(chatInput).toHaveValue('')
    })

    test('should handle API error gracefully', async ({ authPage: page }) => {
      await mockThreads(page, [])
      await page.route('**/api/ai-tools/chat', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        })
      })
      await page.goto('/app/ai-tools/chat')

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Test')
      await chatInput.press('Enter')

      await expect(page.getByText('Something went wrong')).toBeVisible()
    })

    test('should handle network failure', async ({ authPage: page }) => {
      await mockThreads(page, [])
      await page.route('**/api/ai-tools/chat', async (route) => {
        await route.abort('failed')
      })
      await page.goto('/app/ai-tools/chat')

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Test')
      await chatInput.press('Enter')

      await expect(page.getByText('Something went wrong')).toBeVisible()
    })
  })

  test.describe('Chat Input', () => {
    test('should have correct placeholder text', async ({ authPage: page }) => {
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')

      await expect(
        page.getByPlaceholder('Ask me anything about your social media strategy...')
      ).toBeVisible()
    })

    test('should allow typing in input', async ({ authPage: page }) => {
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Hello AI')
      await expect(chatInput).toHaveValue('Hello AI')
    })

    test('should use suggestion button to send message', async ({ authPage: page }) => {
      await mockThreads(page, [])
      await mockChatSSE(page, 'Creating your Twitter post...')
      await page.goto('/app/ai-tools/chat')

      await page.getByRole('button', { name: 'Create a post for Twitter' }).click()

      await expect(page.getByText('Create a post for Twitter').first()).toBeVisible()
      await expect(page.getByText(/Creating your Twitter post/)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Thread Management', () => {
    test('should clear messages when clicking new chat', async ({ authPage: page }) => {
      await mockThreads(page, [])
      await mockChatSSE(page, 'Response message')
      await page.goto('/app/ai-tools/chat')

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Hello')
      await chatInput.press('Enter')

      await expect(page.getByText('Response message')).toBeVisible()

      await page.getByRole('button', { name: 'New Chat' }).click()

      await expect(page.getByText('Hello')).not.toBeVisible()
      await expect(page.getByText('Welcome to MagicSync AI')).toBeVisible()
    })
  })

  test.describe('DESIGN.md Compliance', () => {
    test('should use correct heading style', async ({ authPage: page }) => {
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')

      const heading = page.locator('h1')
      await expect(heading).toHaveClass(/text-lg/)
      await expect(heading).toHaveClass(/font-semibold/)
      await expect(heading).toHaveClass(/text-white/)
    })

    test('should use gray-700/50 borders', async ({ authPage: page }) => {
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')

      const headerBorder = page.locator('.border-gray-700\\/50').first()
      await expect(headerBorder).toBeVisible()
    })

    test('should show sidebar with correct dark styling', async ({ authPage: page }) => {
      await mockThreads(page, [
        { id: 't1', title: 'Active Thread', lastMessageAt: new Date().toISOString() },
      ])
      await page.goto('/app/ai-tools/chat')

      // Sidebar should have dark background
      const sidebar = page.locator('.bg-\\[\\#0d0d0d\\]')
      await expect(sidebar).toBeVisible()
    })
  })
})
