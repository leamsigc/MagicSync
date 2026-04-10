import { test, expect } from '@playwright/test'
import { mockAuthSession } from './fixtures'

test.describe('AI Chat - Streaming & Tool Calls', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
    await page.goto('/app/ai-tools/chat')
  })

  test('should display streaming text correctly', async ({ page }) => {
    // Mock streaming response with text chunks
    await page.route('/api/ai-tools/chat', async (route) => {
      const chunks = [
        { type: 'text', content: 'Hello', done: false },
        { type: 'text', content: ' there!', done: false },
        { type: 'text', content: '', done: true },
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
    await chatInput.fill('Hi')
    await chatInput.press('Enter')

    // Should show streaming content
    await expect(page.getByText('Hello there!')).toBeVisible({ timeout: 10000 })
  })

  test('should handle finish chunk and stop loading state', async ({ page }) => {
    // Mock with delayed finish
    await page.route('/api/ai-tools/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"text","content":"Done","done":false}\n\ndata: {"type":"finish","finishReason":"stop"}\n\n',
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Test')
    await chatInput.press('Enter')

    // Wait for response
    await expect(page.getByText('Done')).toBeVisible({ timeout: 10000 })

    // Loading indicator should be gone
    await expect(page.locator('.animate-bounce')).not.toBeVisible()
  })

  test('should display tool call in chat', async ({ page }) => {
    await page.route('/api/ai-tools/chat', async (route) => {
      const chunks = [
        { type: 'tool', id: 'call-1', toolName: 'retrieve', args: { query: 'test' } },
        { type: 'tool_result', toolCallId: 'call-1', toolName: 'retrieve', output: 'Search results here' },
        { type: 'text', content: 'Here are the results: Search results here', done: false },
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
    await chatInput.fill('Search for test')
    await chatInput.press('Enter')

    // Should show tool call card
    await expect(page.getByText('retrieve')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Search results here')).toBeVisible()
  })

  test('should display thinking/reasoning content', async ({ page }) => {
    await page.route('/api/ai-tools/chat', async (route) => {
      const chunks = [
        { type: 'thinking', content: 'Let me think about this...' },
        { type: 'text', content: 'Here is my answer.', done: false },
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
    await chatInput.fill('Question')
    await chatInput.press('Enter')

    // Should show thinking
    await expect(page.getByText('Reasoning')).toBeVisible({ timeout: 10000 })
  })

  test('should handle multiple tool calls in sequence', async ({ page }) => {
    await page.route('/api/ai-tools/chat', async (route) => {
      const chunks = [
        { type: 'tool', id: 'call-1', toolName: 'retrieve', args: { query: 'docs' } },
        { type: 'tool_result', toolCallId: 'call-1', output: 'Doc result 1' },
        { type: 'tool', id: 'call-2', toolName: 'kb_read', args: { path: '/file.md' } },
        { type: 'tool_result', toolCallId: 'call-2', output: 'File content' },
        { type: 'text', content: 'Final response', done: false },
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
    await chatInput.fill('Get docs')
    await chatInput.press('Enter')

    await expect(page.getByText('retrieve')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('kb_read')).toBeVisible()
    await expect(page.getByText('Final response')).toBeVisible()
  })
})

test.describe('Assets Page - Ingestion', () => {
  test('should successfully ingest document with JWT auth', async ({ page }) => {
    await mockAuthSession(page)

    // Mock documents list
    await page.route('**/api/ai-tools/documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'doc-1',
          originalName: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1000,
          status: 'pending',
          chunkCount: 0,
          createdAt: new Date().toISOString(),
        }]),
      })
    })

    // Mock ingest endpoint - check it receives Bearer token
    await page.route('**/api/ai-tools/documents/doc-1/ingest', async (route) => {
      const auth = route.request().headers()['authorization']
      // Should have Bearer token, not X-User-Id
      if (auth && auth.startsWith('Bearer ')) {
        const sseBody = [
          'data: {"status":"processing","message":"Reading file..."}\n\n',
          'data: {"status":"completed","message":"Ingested 5 chunks","total_chunks":5}\n\n',
          'data: [DONE]\n\n',
        ].join('')
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: sseBody,
        })
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Unauthorized' }),
        })
      }
    })

    await page.goto('/app/ai-tools/chat/assets')

    // Click ingest
    await page.getByRole('button', { name: 'Ingest' }).click()

    // Should succeed without 401
    await expect(page.getByText('Ingested 5 chunks')).toBeVisible({ timeout: 10000 })
  })

  test('should show error toast on 401 during ingest', async ({ page }) => {
    await mockAuthSession(page)

    await page.route('**/api/ai-tools/documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'doc-1',
          originalName: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1000,
          status: 'pending',
          chunkCount: 0,
          createdAt: new Date().toISOString(),
        }]),
      })
    })

    // Mock 401 response
    await page.route('**/api/ai-tools/documents/doc-1/ingest', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Invalid or expired token' }),
      })
    })

    await page.goto('/app/ai-tools/chat/assets')
    await page.getByRole('button', { name: 'Ingest' }).click()

    // Should show error toast
    await expect(page.getByText('Ingestion failed')).toBeVisible({ timeout: 10000 })
  })

  test('should show delete confirmation modal', async ({ page }) => {
    await mockAuthSession(page)

    await page.route('**/api/ai-tools/documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'doc-1',
          originalName: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1000,
          status: 'completed',
          chunkCount: 5,
          createdAt: new Date().toISOString(),
        }]),
      })
    })

    await page.goto('/app/ai-tools/chat/assets')

    // Click delete button
    await page.locator('button:has(i-heroicons-trash)').click()

    // Should show modal with confirmation
    await expect(page.getByText('Delete Document?')).toBeVisible()
    await expect(page.getByText('This will permanently delete the document and all its chunks. This action cannot be undone.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  test('should close delete modal on cancel', async ({ page }) => {
    await mockAuthSession(page)

    await page.route('**/api/ai-tools/documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'doc-1',
          originalName: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1000,
          status: 'completed',
          chunkCount: 5,
          createdAt: new Date().toISOString(),
        }]),
      })
    })

    await page.goto('/app/ai-tools/chat/assets')

    // Click delete button
    await page.locator('button:has(i-heroicons-trash)').click()

    // Modal should be visible
    await expect(page.getByText('Delete Document?')).toBeVisible()

    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Modal should close - document should still be visible
    await expect(page.getByText('Delete Document?')).not.toBeVisible()
    await expect(page.getByText('test.pdf')).toBeVisible()
  })

  test('should delete document after confirmation', async ({ page }) => {
    await mockAuthSession(page)

    await page.route('**/api/ai-tools/documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'doc-1',
          originalName: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1000,
          status: 'completed',
          chunkCount: 5,
          createdAt: new Date().toISOString(),
        }]),
      })
    })

    // Mock delete endpoint
    await page.route('**/api/ai-tools/documents/doc-1', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/app/ai-tools/chat/assets')

    // Click delete button
    await page.locator('button:has(i-heroicons-trash)').click()

    // Click delete in modal
    await page.getByRole('button', { name: 'Delete' }).click()

    // Should show success toast and remove document
    await expect(page.getByText('Document deleted')).toBeVisible()
    await expect(page.getByText('test.pdf')).not.toBeVisible()
  })

  test('should display re-ingest button for completed documents', async ({ page }) => {
    await mockAuthSession(page)

    await page.route('**/api/ai-tools/documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'doc-1',
          originalName: 'completed.pdf',
          mimeType: 'application/pdf',
          size: 1000,
          status: 'completed',
          chunkCount: 10,
          createdAt: new Date().toISOString(),
        }]),
      })
    })

    await page.goto('/app/ai-tools/chat/assets')

    // Should show re-ingest button
    await expect(page.getByRole('button', { name: 'Re-ingest' })).toBeVisible()
  })
})

test.describe('Chat - Code Execution', () => {
  test('should display code execution result with output', async ({ page }) => {
    await mockAuthSession(page)
    await page.goto('/app/ai-tools/chat')

    // Mock streaming with code execution result
    await page.route('/api/ai-tools/chat', async (route) => {
      const chunks = [
        { type: 'tool', id: 'call-1', toolName: 'execute_code', args: { code: '2+3' } },
        { type: 'tool_result', toolCallId: 'call-1', output: JSON.stringify({ output: '5', status: 'success', return_code: 0 }) },
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
    await chatInput.fill('what is 2+3?')
    await chatInput.press('Enter')

    // Should show code execution result
    await expect(page.getByText('Code Execution Result')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('5')).toBeVisible()
  })

  test('should run code only once and not loop', async ({ page }) => {
    await mockAuthSession(page)
    await page.goto('/app/ai-tools/chat')

    let callCount = 0
    await page.route('/api/ai-tools/chat', async (route) => {
      callCount++
      // Should only call once, not loop multiple times
      const chunks = [
        { type: 'tool', id: 'call-1', toolName: 'execute_code', args: { code: '1+1' } },
        { type: 'tool_result', toolCallId: 'call-1', output: JSON.stringify({ output: '2', status: 'success' }) },
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
    await chatInput.fill('calculate 1+1')
    await chatInput.press('Enter')

    await expect(page.getByText('Code Execution Result')).toBeVisible({ timeout: 10000 })
    // Should not call multiple times in a loop
    expect(callCount).toBe(1)
  })
})

test.describe('Chat - Tools Toggle', () => {
  test('should send message with tools enabled by default', async ({ page }) => {
    await mockAuthSession(page)
    await page.goto('/app/ai-tools/chat')

    await page.route('/api/ai-tools/chat', async (route) => {
      const body = await route.request().postDataJSON()
      // Should have enable_tools: true by default
      expect(body.enable_tools).toBe(true)
      
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"finish","finishReason":"stop"}\n\n',
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('Hello')
    await chatInput.press('Enter')
  })

  test('should allow disabling tools for simple questions', async ({ page }) => {
    await mockAuthSession(page)
    await page.goto('/app/ai-tools/chat')

    // Toggle tools off
    await page.locator('button[aria-label="Tools Enabled"]').click()

    await page.route('/api/ai-tools/chat', async (route) => {
      const body = await route.request().postDataJSON()
      // Should have enable_tools: false
      expect(body.enable_tools).toBe(false)
      
      // Should return simple text without tool calls
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"text","content":"2 + 3 equals 5","done":false}\n\ndata: {"type":"finish","finishReason":"stop"}\n\n',
      })
    })

    const chatInput = page.getByPlaceholder('Ask me anything about your social media strategy...')
    await chatInput.fill('what is 2+3?')
    await chatInput.press('Enter')

    await expect(page.getByText('2 + 3 equals 5')).toBeVisible({ timeout: 10000 })
    // Should NOT show any tool call card
    await expect(page.locator('.tool-call')).not.toBeVisible()
  })
})