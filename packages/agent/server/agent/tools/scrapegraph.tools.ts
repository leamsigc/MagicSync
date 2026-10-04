import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { validatePublicSiteUrl } from '#layers/BaseDB/server/utils/url-allowlist'
import {
  apiError,
  extractScrapeMarkdown,
  resolveToolScrapegraphClient,
  type ScrapegraphClientLike,
} from '../../utils/scrapegraph'
import type { AgentToolContext } from '../tool-context'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'SCRAPEGRAPH_ERROR')

async function requireClient(ctx: AgentToolContext): Promise<ScrapegraphClientLike> {
  const client = await resolveToolScrapegraphClient(ctx)
  if (!client) {
    toolError('SCRAPEGRAPH_NOT_CONFIGURED', 'ScrapeGraphAI is not configured. Add an API key in AI settings.')
  }
  return client
}

/** SSRF allowlist check shared by the two URL-taking tools. */
async function safeUrl(ctx: AgentToolContext, url: string): Promise<string> {
  const validated = await (ctx.validateUrl ?? validatePublicSiteUrl)(url)
  if (!validated) toolError('SSRF_BLOCKED', 'URL is not allowed')
  return validated
}

export function createScrapegraphTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'scrapegraph_scrape',
      description: 'Fetch a page as clean markdown using ScrapeGraphAI (default scraper).',
      input: v.object({
        url: v.pipe(v.string(), v.description('Public http(s) URL to scrape')),
      }),
      run: async (toolCtx) => {
        const url = await safeUrl(ctx, toolCtx.data.url)
        const client = await requireClient(ctx)
        const result = await client.scrape({ url, formats: [{ type: 'markdown', mode: 'reader' }] })
        if (result.status !== 'success') toolError('SCRAPEGRAPH_FAILED', apiError(result))
        const markdown = extractScrapeMarkdown(result.data)
        return toolResult({ url, scraper: 'scrapegraphai', untrusted: true, content: (markdown ?? '').slice(0, 20000) })
      },
    }),
    defineTool({
      name: 'scrapegraph_extract',
      description: 'Extract structured JSON from a URL with ScrapeGraphAI using a natural-language prompt.',
      input: v.object({
        url: v.pipe(v.string(), v.description('Public http(s) URL')),
        prompt: v.pipe(v.string(), v.description('What to extract')),
        schema: v.optional(v.record(v.string(), v.unknown())),
      }),
      run: async (toolCtx) => {
        const { prompt, schema } = toolCtx.data
        const url = await safeUrl(ctx, toolCtx.data.url)
        const client = await requireClient(ctx)
        const result = await client.extract({ url, prompt, schema })
        if (result.status !== 'success') toolError('SCRAPEGRAPH_FAILED', apiError(result))
        return toolResult({ url, scraper: 'scrapegraphai', untrusted: true, json: result.data?.json ?? result.data })
      },
    }),
    defineTool({
      name: 'scrapegraph_search',
      description: 'Web search with ScrapeGraphAI, optionally extracting structured data from the results.',
      input: v.object({
        query: v.pipe(v.string(), v.description('Search query')),
        numResults: v.optional(v.pipe(v.number(), v.description('Number of results (1-20, default 5)'))),
      }),
      run: async (toolCtx) => {
        const { query, numResults } = toolCtx.data
        const client = await requireClient(ctx)
        const result = await client.search({
          query,
          numResults: Math.min(Math.max(numResults ?? 5, 1), 20),
        })
        if (result.status !== 'success') toolError('SCRAPEGRAPH_FAILED', apiError(result))
        return toolResult({ query, untrusted: true, results: result.data?.results ?? [] })
      },
    }),
    defineTool({
      name: 'scrapegraph_credits',
      description: 'Report remaining ScrapeGraphAI credits for this account.',
      input: v.object({}),
      run: async () => {
        const client = await requireClient(ctx)
        const result = await client.credits()
        if (result.status !== 'success') toolError('SCRAPEGRAPH_FAILED', apiError(result))
        return toolResult({ credits: result.data ?? null, elapsedMs: result.elapsedMs })
      },
    }),
  ]
}
