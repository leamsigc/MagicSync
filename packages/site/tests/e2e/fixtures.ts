import { test as base, expect, type Page } from '@playwright/test'

/**
 * Mocks the Better Auth session on the page by injecting a session cookie
 * and intercepting the get-session endpoint.
 */
async function mockAuthSession(page: Page) {
  await page.route('**/api/auth/get-session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'test-user-id',
          name: 'Test User',
          email: 'test@example.com',
          role: 'user',
        },
        session: {
          id: 'test-session-id',
          token: 'test-session-token',
          userId: 'test-user-id',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      }),
    })
  })

  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: 'test-session-token',
      domain: 'localhost',
      path: '/',
    },
  ])
}

/**
 * Mocks the chat API endpoint with SSE streaming response.
 * Chunks use the typed format the client parser expects ({type, content}).
 */
async function mockChatSSE(page: Page, response: string = 'Hello! How can I help?') {
  const words = response.split(' ')
  const chunks = words
    .map(w => `data: ${JSON.stringify({ type: 'text.delta', id: `stub:${w}`, delta: `${w} ` })}\n\n`)
    .join('')
  const completed = `data: ${JSON.stringify({ type: 'message.completed', id: 'stub:done', sessionId: 'stub-session', threadId: 'new-thread-id', content: response })}\n\n`
  await page.route('**/api/v1/agent/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'X-Thread-Id': 'new-thread-id' },
      body: chunks + completed,
    })
  })
}

/**
 * Mocks the chat threads list endpoint.
 */
async function mockThreads(page: Page, threads: Array<{ id: string; title: string; lastMessageAt: string }> = []) {
  await page.route('**/api/ai-tools/chat/threads', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(threads),
      })
    } else if (route.request().method() === 'POST') {
      const body = await route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'new-thread-id',
          userId: 'test-user-id',
          title: body.title || 'New Chat',
          createdAt: new Date().toISOString(),
        }),
      })
    }
  })
}

/**
 * Mocks the text-to-sql tool endpoint.
 * Response shape matches what useTextToSQL() consumes ({tables_used}).
 */
async function mockTextToSQL(page: Page, sql: string, explanation: string = 'Query explanation') {
  await page.route('**/api/ai-tools/tools/text-to-sql', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        query: '',
        sql,
        explanation,
        tables_used: ['posts', 'accounts'],
      }),
    })
  })
}

/**
 * Mocks the web search tool endpoint.
 */
async function mockWebSearch(page: Page, results: Array<{ title: string; url: string; snippet: string }> = []) {
  await page.route('**/api/ai-tools/tools/web-search', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results }),
    })
  })
}

/**
 * Mocks the LLM config endpoint.
 */
async function mockLLMConfig(page: Page, configs: Record<string, unknown>[] = []) {
  await page.route('**/api/ai-tools/llm', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(configs),
      })
    } else if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'new-config-id',
          userId: 'test-user-id',
          provider: 'ollama',
          model: 'qwen3.5',
          isDefault: true,
          temperature: 0.7,
          maxTokens: 2048,
        }),
      })
    }
  })
}

// Extend the base test with authenticated fixture
export const test = base.extend<{ authPage: Page }>({
  // Dev-mode vite occasionally triggers a full-reload mid-navigation which
  // aborts the document request (net::ERR_ABORTED). One immediate retry
  // makes goto deterministic without weakening any assertions.
  page: async ({ page }, use) => {
    const originalGoto = page.goto.bind(page)
    page.goto = async (url, options) => {
      try {
        return await originalGoto(url, options)
      }
      catch (error) {
        if (String(error).includes('ERR_ABORTED'))
          return originalGoto(url, options)
        throw error
      }
    }
    await use(page)
  },
  authPage: async ({ page }, use) => {
    await mockAuthSession(page)
    await use(page)
  },
})

/**
 * Mocks the Python backend chat endpoint with streaming SSE response.
 */
async function mockChatAPI(page: Page, response: string = 'Hello! How can I help?') {
  const chunks = response.split(' ').map(w => `data: {"content":"${w} ","done":false}\n\n`).join('')
  await page.route('**/api/ai-tools/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: chunks + 'data: {"content":"","done":true}\n\n',
    })
  })
}

/**
 * Mocks document list endpoint.
 */
async function mockDocumentsList(page: Page, documents: Record<string, unknown>[] = []) {
  await page.route('**/api/ai-tools/documents', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(documents),
      })
    } else {
      await route.continue()
    }
  })
}

/**
 * Mocks document upload endpoint.
 */
async function mockDocumentUpload(page: Page, doc: Record<string, unknown>) {
  await page.route('**/api/ai-tools/documents/upload', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(doc),
    })
  })
}

/**
 * Mocks document deletion endpoint.
 */
async function mockDocumentDelete(page: Page, docId: string) {
  await page.route(`**/api/ai-tools/documents/${docId}`, async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: docId }),
      })
    } else {
      await route.continue()
    }
  })
}

/**
 * Mocks ingestion SSE endpoint.
 */
async function mockIngestionSSE(page: Page, docId: string, totalChunks: number = 3) {
  await page.route(`**/api/ai-tools/documents/${docId}/ingest`, async (route) => {
    const sseBody = [
      `data: {"status":"processing","message":"Reading file..."}\n\n`,
      `data: {"status":"processing","message":"Chunking and embedding..."}\n\n`,
      `data: {"status":"storing","message":"Storing ${totalChunks} chunks...","total_chunks":${totalChunks}}\n\n`,
      `data: {"status":"storing","message":"Stored ${totalChunks}/${totalChunks} chunks","progress":100}\n\n`,
      `data: {"status":"completed","message":"Ingested ${totalChunks} chunks","total_chunks":${totalChunks}}\n\n`,
      `data: [DONE]\n\n`,
    ].join('')

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody,
    })
  })
}

/**
 * Mocks ingestion SSE with skipped status (content unchanged).
 */
async function mockIngestionSkipped(page: Page, docId: string, totalChunks: number = 5) {
  await page.route(`**/api/ai-tools/documents/${docId}/ingest`, async (route) => {
    const sseBody = [
      `data: {"status":"processing","message":"Reading file..."}\n\n`,
      `data: {"status":"skipped","message":"Document content unchanged, skipping re-ingestion","total_chunks":${totalChunks}}\n\n`,
      `data: [DONE]\n\n`,
    ].join('')

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody,
    })
  })
}

/**
 * Mocks ingestion SSE with incremental update info.
 */
async function mockIngestionIncremental(
  page: Page,
  docId: string,
  opts: { totalChunks: number, unchanged: number, changed: number, removed: number }
) {
  const { totalChunks, unchanged, changed, removed } = opts
  await page.route(`**/api/ai-tools/documents/${docId}/ingest`, async (route) => {
    const sseBody = [
      `data: {"status":"processing","message":"Reading file..."}\n\n`,
      `data: {"status":"processing","message":"Chunking and embedding..."}\n\n`,
      `data: {"status":"storing","message":"${unchanged} unchanged, ${changed} new/changed, ${removed} removed","total_chunks":${totalChunks},"unchanged":${unchanged},"changed":${changed},"removed":${removed}}\n\n`,
      changed > 0
        ? `data: {"status":"storing","message":"Stored ${changed}/${changed} new chunks","progress":100}\n\n`
        : '',
      `data: {"status":"completed","message":"Ingested ${totalChunks} chunks (${changed} new, ${unchanged} unchanged)","total_chunks":${totalChunks},"new_chunks":${changed},"unchanged_chunks":${unchanged}}\n\n`,
      `data: [DONE]\n\n`,
    ].join('')

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody,
    })
  })
}

/**
 * Mocks the ingestion SSE with metadata extraction step.
 */
async function mockIngestionWithMetadata(
  page: Page,
  docId: string,
  totalChunks: number = 5,
  metadata: Record<string, unknown> = {}
) {
  const defaultMeta: Record<string, unknown> = {
    title: 'Test Document',
    author: 'Test Author',
    language: 'en',
    topics: ['testing', 'metadata'],
    summary: 'A test document for metadata extraction.',
    document_type: 'technical',
    ...metadata,
  }

  await page.route(`**/api/ai-tools/documents/${docId}/ingest`, async (route) => {
    const sseBody = [
      `data: {"status":"processing","message":"Reading file..."}\n\n`,
      `data: {"status":"processing","message":"Chunking and embedding..."}\n\n`,
      `data: {"status":"storing","message":"Storing ${totalChunks} chunks...","total_chunks":${totalChunks}}\n\n`,
      `data: {"status":"storing","message":"Stored ${totalChunks}/${totalChunks} chunks","progress":100}\n\n`,
      `data: {"status":"extracting","message":"Metadata extracted: \\"${defaultMeta.title}\\"","metadata":${JSON.stringify(defaultMeta)}}\n\n`,
      `data: {"status":"completed","message":"Ingested ${totalChunks} chunks","total_chunks":${totalChunks}}\n\n`,
      `data: [DONE]\n\n`,
    ].join('')

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody,
    })
  })
}

/**
 * Mocks the metadata extraction endpoint.
 */
async function mockMetadataExtraction(
  page: Page,
  docId: string,
  metadata: Record<string, unknown> = {}
) {
  const defaultMeta: Record<string, unknown> = {
    title: 'Test Document',
    author: 'Test Author',
    language: 'en',
    topics: ['testing', 'metadata'],
    summary: 'A test document.',
    document_type: 'technical',
    ...metadata,
  }

  await page.route(`**/api/ai-tools/documents/${docId}/extract-metadata`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(defaultMeta),
    })
  })
}

/**
 * Mocks the retrieval endpoint with metadata in results.
 */
async function mockRetrieval(
  page: Page,
  results: Array<{ content: string, documentId: string, similarity: number, metadata?: Record<string, unknown> }> = []
) {
  await page.route('**/api/ai-tools/retrieve', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        query: 'test query',
        results,
      }),
    })
  })
}

/**
 * Mocks thread list endpoint.
 */
async function mockThreadsList(page: Page, threads: Record<string, unknown>[] = []) {
  await page.route('**/api/ai-tools/chat/threads', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(threads),
      })
    } else if (route.request().method() === 'POST') {
      const body = await route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'new-thread-id',
          userId: 'test-user-id',
          title: body.title,
          createdAt: new Date().toISOString(),
        }),
      })
    }
  })
}

export {
  expect,
  mockAuthSession,
  mockChatAPI,
  mockChatSSE,
  mockDocumentDelete,
  mockDocumentUpload,
  mockDocumentsList,
  mockIngestionIncremental,
  mockIngestionSkipped,
  mockIngestionSSE,
  mockIngestionWithMetadata,
  mockLLMConfig,
  mockMetadataExtraction,
  mockRetrieval,
  mockTextToSQL,
  mockThreads,
  mockThreadsList,
  mockWebSearch,
}
