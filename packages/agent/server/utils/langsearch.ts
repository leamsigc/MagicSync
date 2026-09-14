import { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { toolBackendsService } from '#layers/BaseDB/server/services/tool-backends.service'

// LangSearch Web Search API contract:
// https://docs.langsearch.com/reference/search-api-guide-for-coding-agents
// A successful response has data.webPages.value; fewer results than requested
// (including zero) is valid. 429 carries retry guidance; we retry at most twice.
// LANGSEARCH_API_URL is a test/deployment seam; production uses the public API.
export const LANGSEARCH_ENDPOINT = process.env.LANGSEARCH_API_URL ?? 'https://api.langsearch.com/v1/web-search'

const MAX_RESULTS = 50
const REQUEST_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 3

export interface LangSearchInput {
  query: string
  count?: number
  freshness?: string
  includeDomains?: string[]
  excludeDomains?: string[]
  /** false/omitted = snippets; true = full text; object sets the character cap. */
  fullText?: boolean | { maxCharacters: number }
}

export interface LangSearchResult {
  title: string
  url: string
  text: string
  datePublished: string | null
}

export interface LangSearchOutput {
  results: LangSearchResult[]
  logId: string | null
  usage: { inputTokens: number | null, outputTokens: number | null } | null
}

export type LangSearchClient = (input: LangSearchInput, apiKey: string) => Promise<ServiceResponse<LangSearchOutput>>

const ItemSchema = z.object({
  name: z.string().optional(),
  url: z.string().min(1),
  text: z.string().optional(),
  snippet: z.string().optional(),
  datePublished: z.string().optional(),
}).passthrough()

const ResponseSchema = z.object({
  log_id: z.string().optional(),
  usage: z.object({
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
  }).passthrough().optional(),
  data: z.object({
    webPages: z.object({ value: z.array(ItemSchema) }).passthrough(),
  }).passthrough(),
}).passthrough()

/** Per-user key from AI settings, falling back to the deployment env var. */
export async function resolveLangSearchKey(userId: string): Promise<ServiceResponse<string | null>> {
  const settings = await toolBackendsService.get(userId)
  const userKey = settings.success ? settings.data.langsearchApiKey : null
  return { success: true, data: userKey ?? process.env.LANGSEARCH_API_KEY ?? null }
}

function contentsPayload(fullText: LangSearchInput['fullText']): Record<string, unknown> | null {
  if (fullText === true) return { text: true }
  if (typeof fullText === 'object') return { text: { max_characters: fullText.maxCharacters } }
  return null
}

function buildRequest(input: LangSearchInput): Record<string, unknown> {
  const count = Math.min(Math.max(input.count ?? 5, 1), MAX_RESULTS)
  const contents = contentsPayload(input.fullText)
  return {
    query: input.query,
    count,
    ...(input.freshness ? { freshness: input.freshness } : {}),
    ...(input.includeDomains?.length ? { includeDomains: input.includeDomains } : {}),
    ...(input.excludeDomains?.length ? { excludeDomains: input.excludeDomains } : {}),
    ...(contents ? { contents } : {}),
  }
}

function normalizeResult(item: z.infer<typeof ItemSchema>): LangSearchResult {
  return {
    title: item.name ?? item.url,
    url: item.url,
    text: item.text ?? item.snippet ?? '',
    datePublished: item.datePublished ?? null,
  }
}

function normalizeResponse(payload: unknown): LangSearchOutput | null {
  const parsed = ResponseSchema.safeParse(payload)
  if (!parsed.success) return null
  const usage = parsed.data.usage
  return {
    results: parsed.data.data.webPages.value.map(normalizeResult),
    logId: parsed.data.log_id ?? null,
    usage: usage
      ? { inputTokens: usage.input_tokens ?? null, outputTokens: usage.output_tokens ?? null }
      : null,
  }
}

interface LangSearchFailure {
  code: string
  message: string
  retryable: boolean
  delayMs: number
}

function langSearchFailure(status: number, retryAfterSeconds: number): LangSearchFailure {
  if (status === 400) {
    return { code: 'LANGSEARCH_BAD_REQUEST', message: 'LangSearch rejected the query parameters', retryable: false, delayMs: 0 }
  }
  if (status === 401 || status === 403) {
    return { code: 'LANGSEARCH_AUTH_FAILED', message: 'LangSearch credentials or account access need attention', retryable: false, delayMs: 0 }
  }
  if (status === 429) {
    return { code: 'LANGSEARCH_RATE_LIMITED', message: 'LangSearch rate limit reached', retryable: true, delayMs: Math.min(retryAfterSeconds * 1000, 5000) }
  }
  if (status >= 500) {
    return { code: 'LANGSEARCH_FAILED', message: `LangSearch server error (HTTP ${status})`, retryable: true, delayMs: 500 }
  }
  return { code: 'LANGSEARCH_FAILED', message: `LangSearch request failed (HTTP ${status})`, retryable: false, delayMs: 0 }
}

function retryAfterSeconds(header: string | null): number {
  const parsed = Number(header)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function requestOnce(
  body: Record<string, unknown>,
  apiKey: string,
): Promise<{ ok: true, data: LangSearchOutput } | { ok: false, failure: LangSearchFailure }> {
  try {
    const response = await fetch(LANGSEARCH_ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      return { ok: false, failure: langSearchFailure(response.status, retryAfterSeconds(response.headers.get('retry-after'))) }
    }
    const data = normalizeResponse(await response.json())
    if (!data) {
      return { ok: false, failure: { code: 'LANGSEARCH_BAD_RESPONSE', message: 'LangSearch returned an unexpected payload', retryable: false, delayMs: 0 } }
    }
    return { ok: true, data }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'LangSearch request failed'
    return { ok: false, failure: { code: 'LANGSEARCH_FAILED', message, retryable: true, delayMs: 500 } }
  }
}

/** Bounded-retry LangSearch call. The API key never appears in errors or logs. */
export async function searchLangSearch(input: LangSearchInput, apiKey: string): Promise<ServiceResponse<LangSearchOutput>> {
  const body = buildRequest(input)
  let last: LangSearchFailure = { code: 'LANGSEARCH_FAILED', message: 'Search failed', retryable: false, delayMs: 0 }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await requestOnce(body, apiKey)
    if (result.ok) return { success: true, data: result.data }
    last = result.failure
    if (!result.failure.retryable) break
    if (attempt < MAX_ATTEMPTS) await delay(result.failure.delayMs)
  }
  return { success: false, error: last.message, code: last.code }
}
