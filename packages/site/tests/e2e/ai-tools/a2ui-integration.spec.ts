import { test, expect } from '@playwright/test'

test.describe('A2UI Chat Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/ai-tools/chat')
  })

  test('should render A2UI text component', async ({ page }) => {
    // Mock chat API that returns A2UI components
    await page.route('/api/ai-tools/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: JSON.stringify({
          content: 'Here is your dashboard:',
          done: false,
          a2ui: [
            { id: 'title', component: 'Text', text: 'Dashboard', variant: 'h2' },
            { id: 'subtitle', component: 'Text', text: 'Your analytics overview', variant: 'body' },
          ],
        }),
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Show me my dashboard')
    await chatInput.press('Enter')

    // Check A2UI components are rendered
    await expect(page.getByText('Here is your dashboard:')).toBeVisible()
  })

  test('should render A2UI card component', async ({ page }) => {
    // Mock chat API that returns card component
    await page.route('/api/ai-tools/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: JSON.stringify({
          content: 'Stats:',
          done: false,
          a2ui: [
            { id: 'card', component: 'Card', child: 'content', padding: 16 },
            { id: 'content', component: 'Text', text: 'Total Posts: 142', variant: 'body' },
          ],
        }),
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Show stats')
    await chatInput.press('Enter')

    // Check card content is rendered
    await expect(page.getByText('Total Posts: 142')).toBeVisible()
  })

  test('should render A2UI alert component', async ({ page }) => {
    // Mock chat API that returns alert component
    await page.route('/api/ai-tools/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: JSON.stringify({
          content: 'Notification:',
          done: false,
          a2ui: [
            { id: 'alert', component: 'Alert', text: 'Your post was published!', severity: 'success' },
          ],
        }),
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Check notifications')
    await chatInput.press('Enter')

    // Check alert is rendered
    await expect(page.getByText('Your post was published!')).toBeVisible()
  })

  test('should render A2UI button and handle actions', async ({ page }) => {
    // Mock chat API
    await page.route('/api/ai-tools/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: JSON.stringify({
          content: 'Choose an action:',
          done: false,
          a2ui: [
            { id: 'btn', component: 'Button', label: 'Create Post', variant: 'primary', action: 'create' },
          ],
        }),
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('What can I do?')
    await chatInput.press('Enter')

    // Check button is rendered
    await expect(page.getByRole('button', { name: 'Create Post' })).toBeVisible()
  })

  test('should render A2UI progress component', async ({ page }) => {
    // Mock chat API that returns progress component
    await page.route('/api/ai-tools/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: JSON.stringify({
          content: 'Processing:',
          done: false,
          a2ui: [
            { id: 'progress', component: 'Progress', value: 75, max: 100, label: 'Post scheduling' },
          ],
        }),
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Schedule posts')
    await chatInput.press('Enter')

    // Check progress is rendered
    await expect(page.getByText('Post scheduling')).toBeVisible()
  })

  test('should show unknown component fallback', async ({ page }) => {
    // Mock chat API that returns unknown component
    await page.route('/api/ai-tools/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: JSON.stringify({
          content: 'Custom component:',
          done: false,
          a2ui: [
            { id: 'custom', component: 'CustomUnknown', someProp: 'value' },
          ],
        }),
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test unknown')
    await chatInput.press('Enter')

    // Check fallback is shown
    await expect(page.getByText('Unknown component: CustomUnknown')).toBeVisible()
  })
})
