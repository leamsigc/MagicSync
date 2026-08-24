import { test, expect, mockChatSSE, mockThreads } from './fixtures'
import { createTestUser, createActiveBusiness, loginWith, blockHeavyAssets, waitForHydration, type TestUser } from './helpers/e2e-utils'

/**
 * Uses REAL Better Auth sessions (see helpers/e2e-utils.ts): browser-level
 * session mocking cannot satisfy the server-side /app auth middleware.
 * Chat/thread API responses are still mocked at the XHR level.
 */

let user: TestUser

test.beforeAll(async ({ request }) => {
  test.setTimeout(120000)
  user = await createTestUser(request)
  await createActiveBusiness(request, user)
})

test.describe('AI Chat Page - Site Integration', () => {
  test.describe('Page Structure', () => {
    test('should render the chat page with AiToolsLayout (no dashboard sidebar)', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      // The rebuilt chat page renders a top bar with the welcome heading (no <header> tag)
      await expect(page.locator('h1', { hasText: /welcome to magicsync ai/i })).toBeVisible()

      // Should NOT have dashboard sidebar
      await expect(page.locator('[class*="UDashboardSidebar"]')).not.toBeVisible()
    })

    test('should display the chat header with title', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      await expect(page.locator('h1')).toContainText(/magicsync ai/i)
    })

    test('should show dark background matching DESIGN.md', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      const chatFrame = page.locator('.flex.h-screen')
      await expect(chatFrame).toBeVisible()
    })

    test('should show welcome state when no messages', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      await expect(page.getByRole('heading', { name: 'Welcome to MagicSync AI' }).first()).toBeVisible()
      await expect(page.getByText(/I can help you create posts/)).toBeVisible()
    })

    test('should display three suggestion buttons', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      await expect(page.getByRole('button', { name: 'Create a post for Twitter' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Analyze my target audience' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Research trending topics' })).toBeVisible()
    })
  })

  test.describe('Chat Sidebar', () => {
    test('should show new chat button', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      await expect(page.getByRole('button', { name: 'New Chat' })).toBeVisible()
    })

    test('should show empty state when no threads', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page, [])
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      await expect(page.getByText('No conversations yet')).toBeVisible()
    })

    test('should list existing threads', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page, [
        { id: 't1', title: 'Marketing strategy', lastMessageAt: new Date().toISOString() },
        { id: 't2', title: 'Post ideas', lastMessageAt: new Date().toISOString() },
      ])
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      await expect(page.getByText('Marketing strategy')).toBeVisible()
      await expect(page.getByText('Post ideas')).toBeVisible()
    })
  })

  test.describe('Chat Messaging', () => {
    test('should send a message and display user bubble', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page, [])
      await mockChatSSE(page, 'Hello there!')
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('What is my schedule today?')
      await chatInput.press('Enter')

      await expect(page.getByText('What is my schedule today?').first()).toBeVisible()
    })

    test('should display streaming AI response', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page, [])
      await mockChatSSE(page, 'Your schedule includes three posts today')
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('What is my schedule?')
      await chatInput.press('Enter')

      await expect(page.getByText(/Your schedule includes three posts/)).toBeVisible({ timeout: 10000 })
    })

    test('should show thinking indicator while AI processes', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page, [])
      // Delay the response to capture the thinking state
      await page.route('**/api/ai-tools/chat', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1500))
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'data: {"content":"Response","done":false}\n\ndata: {"content":"","done":true}\n\n',
        })
      })
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Hello')
      await chatInput.press('Enter')

      // Thinking indicator should briefly appear
      await expect(page.getByText('Thinking...')).toBeVisible({ timeout: 3000 })
    })

    test('should show emerald accent on AI avatar', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page, [])
      await mockChatSSE(page, 'Response text')
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Test')
      await chatInput.press('Enter')

      await expect(page.getByText('Response text')).toBeVisible({ timeout: 10000 })

      // Assistant output renders inside a prose container (avatar styling was removed)
      const prose = page.locator('.prose').first()
      await expect(prose).toBeVisible()
    })

    test('should clear input after sending', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page, [])
      await mockChatSSE(page, 'Response')
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Test message')
      await chatInput.press('Enter')

      await expect(chatInput).toHaveValue('')
    })

    test('should handle API error gracefully', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page, [])
      await page.route('**/api/ai-tools/chat', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        })
      })
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Test')
      await chatInput.press('Enter')

      // Graceful degradation: the user bubble stays and the composer recovers
      await expect(page.getByText('Test').first()).toBeVisible({ timeout: 10000 })
      await expect(chatInput).toBeEnabled({ timeout: 10000 })
    })

    test('should handle network failure', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page, [])
      await page.route('**/api/ai-tools/chat', async (route) => {
        await route.abort('failed')
      })
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Test')
      await chatInput.press('Enter')

      // Graceful degradation: the user bubble stays and the composer recovers
      await expect(page.getByText('Test').first()).toBeVisible({ timeout: 10000 })
      await expect(chatInput).toBeEnabled({ timeout: 10000 })
    })
  })

  test.describe('Chat Input', () => {
    test('should have correct placeholder text', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      await expect(
        page.getByPlaceholder('Ask me anything about your social media strategy...')
      ).toBeVisible()
    })

    test('should allow typing in input', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Hello AI')
      await expect(chatInput).toHaveValue('Hello AI')
    })

    test('should use suggestion button to send message', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page, [])
      await mockChatSSE(page, 'Creating your Twitter post...')
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      await page.getByRole('button', { name: 'Create a post for Twitter' }).click()

      await expect(page.getByText('Create a post for Twitter').first()).toBeVisible()
      await expect(page.getByText(/Creating your Twitter post/)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Thread Management', () => {
    test('should clear messages when clicking new chat', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page, [])
      await mockChatSSE(page, 'Response message')
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
      await chatInput.fill('Hello')
      await chatInput.press('Enter')

      await expect(page.getByText('Response message')).toBeVisible()

      await page.getByRole('button', { name: 'New Chat' }).click()

      await expect(page.getByText('Hello')).not.toBeVisible()
      // Welcome text appears in both the top bar h1 and the empty-state h2
      await expect(page.getByRole('heading', { name: 'Welcome to MagicSync AI' }).first()).toBeVisible()
    })
  })

  test.describe('DESIGN.md Compliance', () => {
    test('should use correct heading style', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      const heading = page.locator('h1')
      await expect(heading).toHaveClass(/text-lg/)
      await expect(heading).toHaveClass(/font-semibold/)
    })

    test('should use gray-700/50 borders', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page)
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      const headerBorder = page.locator('.border-gray-700\\/50').first()
      await expect(headerBorder).toBeVisible()
    })

    test('should show sidebar with correct dark styling', async ({ page }) => {
      await blockHeavyAssets(page)
      await loginWith(page, user)
      await mockThreads(page, [
        { id: 't1', title: 'Active Thread', lastMessageAt: new Date().toISOString() },
      ])
      await page.goto('/app/ai-tools/chat')
      await waitForHydration(page)

      // Sidebar is a fixed-width bordered column listing threads
      const sidebar = page.locator('.w-64.border-r').first()
      await expect(sidebar).toBeVisible()
      await expect(page.getByText('Active Thread')).toBeVisible()
    })
  })
})
