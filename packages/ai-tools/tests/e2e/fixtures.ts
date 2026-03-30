import { test as base, expect, type Page } from '@playwright/test'

/**
 * Mocks the Better Auth session on the page by injecting a session cookie
 * and intercepting the get-session endpoint.
 */
async function mockAuthSession(page: Page) {
  // Mock the Better Auth session endpoint
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

  // Set auth cookie
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
async function mockDocumentsList(page: Page, documents: any[] = []) {
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
async function mockDocumentUpload(page: Page, doc: any) {
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
  opts: { totalChunks: number; unchanged: number; changed: number; removed: number }
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
  metadata: Record<string, any> = {}
) {
  const defaultMeta = {
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
      `data: {"status":"extracting","message":"Extracting document metadata..."}\n\n`,
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
  metadata: Record<string, any> = {}
) {
  const defaultMeta = {
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
  results: Array<{ content: string; documentId: string; similarity: number; metadata?: any }> = []
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
async function mockThreadsList(page: Page, threads: any[] = []) {
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

// Extend the base test with authenticated fixture
export const test = base.extend<{
  authPage: Page
}>({
  authPage: async ({ page }, use) => {
    await mockAuthSession(page)
    await use(page)
  },
})

export {
  expect,
  mockAuthSession,
  mockChatAPI,
  mockDocumentsList,
  mockDocumentUpload,
  mockDocumentDelete,
  mockIngestionSSE,
  mockIngestionSkipped,
  mockIngestionIncremental,
  mockIngestionWithMetadata,
  mockMetadataExtraction,
  mockRetrieval,
  mockThreadsList,
}
