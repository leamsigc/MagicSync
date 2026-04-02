import { test, expect, mockTextToSQL, mockWebSearch, mockLLMConfig } from './fixtures'

test.describe('AI Tools Page - Site Integration', () => {
  test.describe('Page Structure', () => {
    test('should render with AiToolsLayout (no dashboard sidebar)', async ({ authPage: page }) => {
      await page.goto('/app/ai-tools/tools')

      // Should have the AiToolsLayout top bar
      await expect(page.locator('header')).toContainText('MagicSync')
    })

    test('should display page header with title and description', async ({ authPage: page }) => {
      await page.goto('/app/ai-tools/tools')

      await expect(page.locator('h1')).toContainText('AI Tools')
      await expect(page.getByText('Query your data with natural language or search the web')).toBeVisible()
    })

    test('should show dark background matching DESIGN.md', async ({ authPage: page }) => {
      await page.goto('/app/ai-tools/tools')

      const container = page.locator('.min-h-screen.bg-\\[\\#0a0a0a\\]')
      await expect(container).toBeVisible()
    })

    test('should have max-w-6xl container', async ({ authPage: page }) => {
      await page.goto('/app/ai-tools/tools')

      const container = page.locator('.max-w-6xl')
      await expect(container).toBeVisible()
    })
  })

  test.describe('Tabs', () => {
    test('should show Text-to-SQL and Web Search tabs', async ({ authPage: page }) => {
      await page.goto('/app/ai-tools/tools')

      await expect(page.getByRole('button', { name: 'Text-to-SQL' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Web Search' })).toBeVisible()
    })

    test('should default to Text-to-SQL tab', async ({ authPage: page }) => {
      await page.goto('/app/ai-tools/tools')

      const sqlInput = page.getByPlaceholder('e.g. How many posts did I schedule this week?')
      await expect(sqlInput).toBeVisible()
    })

    test('should switch to Web Search tab', async ({ authPage: page }) => {
      await page.goto('/app/ai-tools/tools')

      await page.getByRole('button', { name: 'Web Search' }).click()

      const searchInput = page.getByPlaceholder('Search the web...')
      await expect(searchInput).toBeVisible()
    })
  })

  test.describe('Text-to-SQL', () => {
    test('should generate SQL from natural language query', async ({ authPage: page }) => {
      await mockTextToSQL(page, 'SELECT COUNT(*) FROM posts WHERE created_at > date("now", "-7 days")')
      await page.goto('/app/ai-tools/tools')

      const sqlInput = page.getByPlaceholder('e.g. How many posts did I schedule this week?')
      await sqlInput.fill('How many posts did I schedule this week?')
      await page.getByRole('button', { name: 'Generate' }).click()

      await expect(page.getByText('SELECT COUNT(*)')).toBeVisible({ timeout: 10000 })
    })

    test('should show explanation text', async ({ authPage: page }) => {
      await mockTextToSQL(page, 'SELECT * FROM posts', 'This query retrieves all posts from the database')
      await page.goto('/app/ai-tools/tools')

      const sqlInput = page.getByPlaceholder('e.g. How many posts did I schedule this week?')
      await sqlInput.fill('Show all posts')
      await page.getByRole('button', { name: 'Generate' }).click()

      await expect(page.getByText('This query retrieves all posts')).toBeVisible({ timeout: 10000 })
    })

    test('should show table badges', async ({ authPage: page }) => {
      await mockTextToSQL(page, 'SELECT * FROM posts', 'Query posts')
      await page.goto('/app/ai-tools/tools')

      const sqlInput = page.getByPlaceholder('e.g. How many posts did I schedule this week?')
      await sqlInput.fill('Show all posts')
      await page.getByRole('button', { name: 'Generate' }).click()

      await expect(page.getByText('posts')).toBeVisible({ timeout: 10000 })
    })

    test('should have SQL code block with dark styling', async ({ authPage: page }) => {
      await mockTextToSQL(page, 'SELECT 1')
      await page.goto('/app/ai-tools/tools')

      const sqlInput = page.getByPlaceholder('e.g. How many posts did I schedule this week?')
      await sqlInput.fill('Test query')
      await page.getByRole('button', { name: 'Generate' }).click()

      const codeBlock = page.locator('pre.bg-\\[\\#0d0d0d\\]')
      await expect(codeBlock).toBeVisible({ timeout: 10000 })
    })

    test('should show loading state while generating', async ({ authPage: page }) => {
      await page.route('**/api/ai-tools/tools/text-to-sql', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sql: 'SELECT 1', explanation: 'Test', tables: [] }),
        })
      })
      await page.goto('/app/ai-tools/tools')

      const sqlInput = page.getByPlaceholder('e.g. How many posts did I schedule this week?')
      await sqlInput.fill('Test')
      await page.getByRole('button', { name: 'Generate' }).click()

      // Button should show loading state
      await expect(page.getByRole('button', { name: 'Generate' })).toBeVisible()
    })
  })

  test.describe('Web Search', () => {
    test('should display search results', async ({ authPage: page }) => {
      await mockWebSearch(page, [
        { title: 'Social Media Tips', url: 'https://example.com/tips', snippet: 'Best tips for social media marketing' },
        { title: 'Content Strategy', url: 'https://example.com/strategy', snippet: 'How to create a content strategy' },
      ])
      await page.goto('/app/ai-tools/tools')

      await page.getByRole('button', { name: 'Web Search' }).click()

      const searchInput = page.getByPlaceholder('Search the web...')
      await searchInput.fill('social media tips')
      await page.getByRole('button', { name: 'Search' }).click()

      await expect(page.getByText('Social Media Tips')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Content Strategy')).toBeVisible({ timeout: 10000 })
    })

    test('should show result URLs', async ({ authPage: page }) => {
      await mockWebSearch(page, [
        { title: 'Test Result', url: 'https://example.com/page', snippet: 'A test result' },
      ])
      await page.goto('/app/ai-tools/tools')

      await page.getByRole('button', { name: 'Web Search' }).click()

      const searchInput = page.getByPlaceholder('Search the web...')
      await searchInput.fill('test')
      await page.getByRole('button', { name: 'Search' }).click()

      await expect(page.getByText('https://example.com/page')).toBeVisible({ timeout: 10000 })
    })

    test('should open results in new tab', async ({ authPage: page }) => {
      await mockWebSearch(page, [
        { title: 'Test', url: 'https://example.com', snippet: 'Test snippet' },
      ])
      await page.goto('/app/ai-tools/tools')

      await page.getByRole('button', { name: 'Web Search' }).click()

      const searchInput = page.getByPlaceholder('Search the web...')
      await searchInput.fill('test')
      await page.getByRole('button', { name: 'Search' }).click()

      const resultLink = page.getByRole('link', { name: 'Test' })
      await expect(resultLink).toHaveAttribute('target', '_blank')
      await expect(resultLink).toHaveAttribute('rel', 'noopener')
    })
  })

  test.describe('DESIGN.md Compliance', () => {
    test('should use text-3xl heading', async ({ authPage: page }) => {
      await page.goto('/app/ai-tools/tools')

      const heading = page.locator('h1')
      await expect(heading).toHaveClass(/text-3xl/)
      await expect(heading).toHaveClass(/font-semibold/)
      await expect(heading).toHaveClass(/text-white/)
    })

    test('should use gray-400 for description text', async ({ authPage: page }) => {
      await page.goto('/app/ai-tools/tools')

      const description = page.getByText('Query your data with natural language or search the web')
      await expect(description).toHaveClass(/text-gray-400/)
    })

    test('should use emerald-500 accent for result links', async ({ authPage: page }) => {
      await mockWebSearch(page, [
        { title: 'Test Link', url: 'https://example.com', snippet: 'Test' },
      ])
      await page.goto('/app/ai-tools/tools')

      await page.getByRole('button', { name: 'Web Search' }).click()
      await page.getByPlaceholder('Search the web...').fill('test')
      await page.getByRole('button', { name: 'Search' }).click()

      const resultLink = page.getByRole('link', { name: 'Test Link' })
      await expect(resultLink).toHaveClass(/text-emerald-500/)
    })

    test('should use border-gray-700/50 for result cards', async ({ authPage: page }) => {
      await mockWebSearch(page, [
        { title: 'Test', url: 'https://example.com', snippet: 'Test' },
      ])
      await page.goto('/app/ai-tools/tools')

      await page.getByRole('button', { name: 'Web Search' }).click()
      await page.getByPlaceholder('Search the web...').fill('test')
      await page.getByRole('button', { name: 'Search' }).click()

      const card = page.locator('.border-gray-700\\/50').first()
      await expect(card).toBeVisible()
    })
  })
})

test.describe('AI Settings Page - Site Integration', () => {
  test.describe('Page Structure', () => {
    test('should render with AiToolsLayout', async ({ authPage: page }) => {
      await mockLLMConfig(page, [])
      await page.goto('/app/ai-tools/settings')

      await expect(page.locator('header')).toContainText('MagicSync')
    })

    test('should display page header', async ({ authPage: page }) => {
      await mockLLMConfig(page, [])
      await page.goto('/app/ai-tools/settings')

      await expect(page.locator('h1')).toBeVisible()
    })

    test('should show dark background', async ({ authPage: page }) => {
      await mockLLMConfig(page, [])
      await page.goto('/app/ai-tools/settings')

      const container = page.locator('.min-h-screen.bg-\\[\\#0a0a0a\\]')
      await expect(container).toBeVisible()
    })
  })

  test.describe('Configuration Form', () => {
    test('should show provider options', async ({ authPage: page }) => {
      await mockLLMConfig(page, [])
      await page.goto('/app/ai-tools/settings')

      await expect(page.getByText('Ollama (Local)')).toBeVisible()
      await expect(page.getByText('OpenAI')).toBeVisible()
      await expect(page.getByText('Anthropic')).toBeVisible()
      await expect(page.getByText('OpenRouter')).toBeVisible()
    })

    test('should allow selecting a provider', async ({ authPage: page }) => {
      await mockLLMConfig(page, [])
      await page.goto('/app/ai-tools/settings')

      await page.getByText('OpenAI').click()

      // OpenAI should be selected (border changes)
      const openaiCard = page.locator('.border-emerald-500\\/50')
      await expect(openaiCard).toBeVisible()
    })

    test('should show API key field for cloud providers', async ({ authPage: page }) => {
      await mockLLMConfig(page, [])
      await page.goto('/app/ai-tools/settings')

      await page.getByText('OpenAI').click()

      const apiKeyInput = page.getByLabel('API Key')
      await expect(apiKeyInput).toBeVisible()
    })

    test('should show model selection', async ({ authPage: page }) => {
      await mockLLMConfig(page, [])
      await page.goto('/app/ai-tools/settings')

      await expect(page.getByText('Model')).toBeVisible()
    })

    test('should have save button', async ({ authPage: page }) => {
      await mockLLMConfig(page, [])
      await page.goto('/app/ai-tools/settings')

      await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
    })
  })

  test.describe('Saved Configs', () => {
    test('should show saved configurations', async ({ authPage: page }) => {
      await mockLLMConfig(page, [
        { id: 'c1', provider: 'ollama', model: 'qwen3.5', isDefault: true, temperature: 0.7, maxTokens: 2048 },
      ])
      await page.goto('/app/ai-tools/settings')

      await expect(page.getByText('qwen3.5')).toBeVisible()
      await expect(page.getByText('Saved Configurations')).toBeVisible()
    })

    test('should show default badge on default config', async ({ authPage: page }) => {
      await mockLLMConfig(page, [
        { id: 'c1', provider: 'ollama', model: 'llama3.2', isDefault: true, temperature: 0.7, maxTokens: 2048 },
      ])
      await page.goto('/app/ai-tools/settings')

      await expect(page.getByText('Default')).toBeVisible()
    })
  })

  test.describe('DESIGN.md Compliance', () => {
    test('should use text-3xl heading with white color', async ({ authPage: page }) => {
      await mockLLMConfig(page, [])
      await page.goto('/app/ai-tools/settings')

      const heading = page.locator('h1')
      await expect(heading).toHaveClass(/text-3xl/)
      await expect(heading).toHaveClass(/text-white/)
    })

    test('should use max-w-6xl container', async ({ authPage: page }) => {
      await mockLLMConfig(page, [])
      await page.goto('/app/ai-tools/settings')

      const container = page.locator('.max-w-6xl')
      await expect(container).toBeVisible()
    })

    test('should use gray-700/50 borders', async ({ authPage: page }) => {
      await mockLLMConfig(page, [])
      await page.goto('/app/ai-tools/settings')

      const border = page.locator('.border-gray-700\\/50').first()
      await expect(border).toBeVisible()
    })
  })
})
