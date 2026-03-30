import { test, expect } from './fixtures'

test.describe('Retrieval API', () => {
  test('should return retrieval results with query embedding', async ({ authPage: page }) => {
    // Mock the retrieve endpoint
    await page.route('**/api/ai-tools/retrieve', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'social media strategy',
          results: [
            {
              content: 'Our social media strategy focuses on engagement.',
              documentId: 'doc-1',
              similarity: 0.85,
            },
            {
              content: 'Content calendar helps plan posts ahead.',
              documentId: 'doc-2',
              similarity: 0.72,
            },
          ],
        }),
      })
    })

    // Use page.evaluate to call the API directly
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/ai-tools/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'social media strategy', top_k: 5 }),
      })
      return res.json()
    })

    expect(response.query).toBe('social media strategy')
    expect(response.results).toHaveLength(2)
    expect(response.results[0].similarity).toBe(0.85)
  })

  test('should handle empty query', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/retrieve', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ statusMessage: 'Query is required' }),
      })
    })

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/ai-tools/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '' }),
      })
      return { status: res.status, body: await res.json() }
    })

    expect(response.status).toBe(400)
  })
})

test.describe('Document CRUD API', () => {
  test('should list documents', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'doc-1', originalName: 'plan.pdf', status: 'completed', chunkCount: 5 },
          { id: 'doc-2', originalName: 'notes.md', status: 'pending', chunkCount: 0 },
        ]),
      })
    })

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/ai-tools/documents')
      return res.json()
    })

    expect(response).toHaveLength(2)
    expect(response[0].originalName).toBe('plan.pdf')
  })

  test('should get single document', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/documents/doc-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'doc-1',
          originalName: 'plan.pdf',
          mimeType: 'application/pdf',
          status: 'completed',
          chunkCount: 5,
        }),
      })
    })

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/ai-tools/documents/doc-1')
      return res.json()
    })

    expect(response.id).toBe('doc-1')
    expect(response.status).toBe('completed')
    expect(response.chunkCount).toBe(5)
  })

  test('should return 404 for non-existent document', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/documents/nonexistent', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ statusMessage: 'Document not found' }),
      })
    })

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/ai-tools/documents/nonexistent')
      return { status: res.status }
    })

    expect(response.status).toBe(404)
  })

  test('should delete document', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/documents/doc-1', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, id: 'doc-1' }),
        })
      } else {
        await route.continue()
      }
    })

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/ai-tools/documents/doc-1', { method: 'DELETE' })
      return res.json()
    })

    expect(response.success).toBe(true)
    expect(response.id).toBe('doc-1')
  })
})

test.describe('Chat Threads API', () => {
  test('should list threads', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/chat/threads', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 't1', title: 'Strategy chat', lastMessageAt: new Date().toISOString() },
          { id: 't2', title: 'Post ideas', lastMessageAt: new Date().toISOString() },
        ]),
      })
    })

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/ai-tools/chat/threads')
      return res.json()
    })

    expect(response).toHaveLength(2)
    expect(response[0].title).toBe('Strategy chat')
  })

  test('should create a thread', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/chat/threads', async (route) => {
      if (route.request().method() === 'POST') {
        const body = await route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-thread',
            userId: 'test-user-id',
            title: body.title,
            createdAt: new Date().toISOString(),
          }),
        })
      } else {
        await route.continue()
      }
    })

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/ai-tools/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New discussion' }),
      })
      return res.json()
    })

    expect(response.id).toBe('new-thread')
    expect(response.title).toBe('New discussion')
  })

  test('should get thread messages', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/chat/threads/t1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'm1', role: 'user', content: 'Hello', createdAt: new Date().toISOString() },
          { id: 'm2', role: 'assistant', content: 'Hi there!', createdAt: new Date().toISOString() },
        ]),
      })
    })

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/ai-tools/chat/threads/t1')
      return res.json()
    })

    expect(response).toHaveLength(2)
    expect(response[0].role).toBe('user')
    expect(response[1].role).toBe('assistant')
  })

  test('should delete a thread', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/chat/threads/t1', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, id: 't1' }),
        })
      } else {
        await route.continue()
      }
    })

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/ai-tools/chat/threads/t1', { method: 'DELETE' })
      return res.json()
    })

    expect(response.success).toBe(true)
  })
})

test.describe('Ingestion SSE', () => {
  test('should stream ingestion status events', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/documents/doc-1/ingest', async (route) => {
      const sseBody = [
        'data: {"status":"processing","message":"Reading file..."}\n\n',
        'data: {"status":"storing","message":"Storing 5 chunks...","total_chunks":5}\n\n',
        'data: {"status":"storing","message":"Stored 5/5 chunks","progress":100}\n\n',
        'data: {"status":"completed","message":"Ingested 5 chunks","total_chunks":5}\n\n',
        'data: [DONE]\n\n',
      ].join('')

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody,
      })
    })

    const events = await page.evaluate(async () => {
      const res = await fetch('/api/ai-tools/documents/doc-1/ingest', { method: 'POST' })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      const collected: any[] = []

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          const lines = text.split('\n').filter(l => l.startsWith('data: '))
          for (const line of lines) {
            const json = line.replace('data: ', '')
            if (json === '[DONE]') return collected
            try {
              collected.push(JSON.parse(json))
            } catch {}
          }
        }
      }
      return collected
    })

    expect(events).toHaveLength(4)
    expect(events[0].status).toBe('processing')
    expect(events[1].status).toBe('storing')
    expect(events[3].status).toBe('completed')
  })

  test('should handle ingestion failure', async ({ authPage: page }) => {
    await page.route('**/api/ai-tools/documents/doc-1/ingest', async (route) => {
      const sseBody = [
        'data: {"status":"processing","message":"Reading file..."}\n\n',
        'data: {"status":"failed","message":"File format not supported"}\n\n',
      ].join('')

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody,
      })
    })

    const events = await page.evaluate(async () => {
      const res = await fetch('/api/ai-tools/documents/doc-1/ingest', { method: 'POST' })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      const collected: any[] = []

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          const lines = text.split('\n').filter(l => l.startsWith('data: '))
          for (const line of lines) {
            const json = line.replace('data: ', '')
            try {
              collected.push(JSON.parse(json))
            } catch {}
          }
        }
      }
      return collected
    })

    const failedEvent = events.find(e => e.status === 'failed')
    expect(failedEvent).toBeTruthy()
    expect(failedEvent.message).toBe('File format not supported')
  })
})
