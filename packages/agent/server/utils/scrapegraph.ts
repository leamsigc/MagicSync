import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { toolBackendsService } from '#layers/BaseDB/server/services/tool-backends.service'

export interface ScrapegraphApiResult<T> {
  status: 'success' | 'error'
  data: T | null
  error?: string
  elapsedMs: number
}

export interface ScrapegraphScrapeParams {
  url: string
  formats?: Array<Record<string, unknown>>
  fetchConfig?: Record<string, unknown>
}

export interface ScrapegraphExtractParams {
  url: string
  prompt: string
  schema?: Record<string, unknown>
}

export interface ScrapegraphSearchParams {
  query: string
  numResults?: number
}

/** Minimal structural contract for the SDK client (tests inject a fake). */
export interface ScrapegraphClientLike {
  scrape: (params: ScrapegraphScrapeParams) => Promise<ScrapegraphApiResult<Record<string, unknown>>>
  extract: (params: ScrapegraphExtractParams) => Promise<ScrapegraphApiResult<Record<string, unknown>>>
  search: (params: ScrapegraphSearchParams) => Promise<ScrapegraphApiResult<Record<string, unknown>>>
  credits: () => Promise<ScrapegraphApiResult<Record<string, unknown>>>
}

export async function createScrapegraphClient(apiKey: string): Promise<ScrapegraphClientLike> {
  const { ScrapeGraphAI } = await import('scrapegraph-js')
  const client = ScrapeGraphAI({ apiKey })
  return client as ScrapegraphClientLike
}

/** Resolve the per-user ScrapeGraphAI client from settings (fallback: SGAI_API_KEY env). */
export async function resolveScrapegraphClient(userId: string): Promise<ServiceResponse<ScrapegraphClientLike>> {
  const settings = await toolBackendsService.get(userId)
  const apiKey = settings.data?.scrapegraphApiKey ?? process.env.SGAI_API_KEY ?? null
  if (!apiKey) {
    return {
      success: false,
      error: 'ScrapeGraphAI is not configured. Add an API key in AI settings.',
      code: 'SCRAPEGRAPH_NOT_CONFIGURED',
    }
  }
  try {
    return { success: true, data: await createScrapegraphClient(apiKey) }
  }
  catch {
    return { success: false, error: 'Failed to initialize ScrapeGraphAI', code: 'SCRAPEGRAPH_INIT_FAILED' }
  }
}

/** Tool-facing resolver: honors an injected test client, otherwise loads settings. */
export async function resolveToolScrapegraphClient(input: {
  userId: string
  scrapegraph?: ScrapegraphClientLike
}): Promise<ScrapegraphClientLike | null> {
  if (input.scrapegraph) return input.scrapegraph
  const resolved = await resolveScrapegraphClient(input.userId)
  return resolved.success ? resolved.data : null
}

export function extractScrapeMarkdown(data: Record<string, unknown> | null): string | null {
  const results = data?.results as { markdown?: { data?: unknown } } | undefined
  const entries = results?.markdown?.data
  if (!Array.isArray(entries) || entries.length === 0) return null
  const first = entries[0]
  return typeof first === 'string' ? first : null
}

export function apiError(result: ScrapegraphApiResult<unknown>): string {
  return result.error || 'ScrapeGraphAI request failed'
}
