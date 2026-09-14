import { Type } from 'typebox'
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent'
import { validatePublicSiteUrl } from '#layers/BaseDB/server/utils/url-allowlist'
import {
  apiError,
  extractScrapeMarkdown,
  resolveToolScrapegraphClient,
  type ScrapegraphClientLike,
} from '../../utils/scrapegraph'
import type { AgentToolContext } from '../tool-context'

function toolResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }], details: {} }
}

function toolError(code: string | undefined, message: string): never {
  throw new Error(`${code ?? 'SCRAPEGRAPH_ERROR'}: ${message}`)
}

async function requireClient(ctx: AgentToolContext): Promise<ScrapegraphClientLike> {
  const client = await resolveToolScrapegraphClient(ctx)
  if (!client) {
    toolError('SCRAPEGRAPH_NOT_CONFIGURED', 'ScrapeGraphAI is not configured. Add an API key in AI settings.')
  }
  return client
}

export function createScrapegraphTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'scrapegraph_scrape',
      label: 'Scrape with ScrapeGraphAI',
      description: 'Fetch a page as clean markdown using ScrapeGraphAI (default scraper).',
      parameters: Type.Object({
        url: Type.String({ description: 'Public http(s) URL to scrape' }),
      }),
      execute: async (_toolCallId, params) => {
        const safeUrl = await (ctx.validateUrl ?? validatePublicSiteUrl)(params.url)
        if (!safeUrl) toolError('SSRF_BLOCKED', 'URL is not allowed')
        const client = await requireClient(ctx)
        const result = await client.scrape({ url: safeUrl, formats: [{ type: 'markdown', mode: 'reader' }] })
        if (result.status !== 'success') toolError('SCRAPEGRAPH_FAILED', apiError(result))
        const markdown = extractScrapeMarkdown(result.data)
        return toolResult({ url: safeUrl, scraper: 'scrapegraphai', untrusted: true, content: (markdown ?? '').slice(0, 20000) })
      },
    }),
    defineTool({
      name: 'scrapegraph_extract',
      label: 'Extract structured data',
      description: 'Extract structured JSON from a URL with ScrapeGraphAI using a natural-language prompt.',
      parameters: Type.Object({
        url: Type.String({ description: 'Public http(s) URL' }),
        prompt: Type.String({ description: 'What to extract' }),
        schema: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: 'Optional JSON schema for the output' })),
      }),
      execute: async (_toolCallId, params) => {
        const safeUrl = await (ctx.validateUrl ?? validatePublicSiteUrl)(params.url)
        if (!safeUrl) toolError('SSRF_BLOCKED', 'URL is not allowed')
        const client = await requireClient(ctx)
        const result = await client.extract({ url: safeUrl, prompt: params.prompt, schema: params.schema })
        if (result.status !== 'success') toolError('SCRAPEGRAPH_FAILED', apiError(result))
        return toolResult({ url: safeUrl, scraper: 'scrapegraphai', untrusted: true, json: result.data?.json ?? result.data })
      },
    }),
    defineTool({
      name: 'scrapegraph_search',
      label: 'Search the web',
      description: 'Web search with ScrapeGraphAI, optionally extracting structured data from the results.',
      parameters: Type.Object({
        query: Type.String({ description: 'Search query' }),
        numResults: Type.Optional(Type.Number({ description: 'Number of results (1-20, default 5)' })),
      }),
      execute: async (_toolCallId, params) => {
        const client = await requireClient(ctx)
        const result = await client.search({
          query: params.query,
          numResults: Math.min(Math.max(params.numResults ?? 5, 1), 20),
        })
        if (result.status !== 'success') toolError('SCRAPEGRAPH_FAILED', apiError(result))
        return toolResult({ query: params.query, untrusted: true, results: result.data?.results ?? [] })
      },
    }),
    defineTool({
      name: 'scrapegraph_credits',
      label: 'ScrapeGraphAI credits',
      description: 'Report remaining ScrapeGraphAI credits for this account.',
      parameters: Type.Object({}),
      execute: async () => {
        const client = await requireClient(ctx)
        const result = await client.credits()
        if (result.status !== 'success') toolError('SCRAPEGRAPH_FAILED', apiError(result))
        return toolResult({ credits: result.data ?? null, elapsedMs: result.elapsedMs })
      },
    }),
  ]
}
