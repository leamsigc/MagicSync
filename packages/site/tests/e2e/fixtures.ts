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
 */
async function mockChatSSE(page: Page, response: string = 'Hello! How can I help?') {
  const words = response.split(' ')
  const chunks = words.map(w => `data: {"content":"${w} ","done":false}\n\n`).join('')
  await page.route('**/api/ai-tools/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: chunks + 'data: {"content":"","done":true}\n\n',
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
 */
async function mockTextToSQL(page: Page, sql: string, explanation: string = 'Query explanation') {
  await page.route('**/api/ai-tools/tools/text-to-sql', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sql,
        explanation,
        tables: ['posts', 'accounts'],
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
async function mockLLMConfig(page: Page, configs: any[] = []) {
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
  authPage: async ({ page }, use) => {
    await mockAuthSession(page)
    await use(page)
  },
})

export {
  expect,
  mockAuthSession,
  mockChatSSE,
  mockThreads,
  mockTextToSQL,
  mockWebSearch,
  mockLLMConfig,
}
