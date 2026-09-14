import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { toolBackendsService } from '#layers/BaseDB/server/services/tool-backends.service'
import { callPythonBackend } from '#layers/BaseAgent/server/utils/python-tools'
import { createScrapegraphClient } from '#layers/BaseAgent/server/utils/scrapegraph'
import { searchLangSearch } from '#layers/BaseAgent/server/utils/langsearch'

const TestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scrapegraph'), apiKey: z.string().max(512).optional() }),
  z.object({ kind: z.literal('langsearch'), apiKey: z.string().max(512).optional() }),
  z.object({
    kind: z.literal('python'),
    url: z.string().max(512).optional(),
    token: z.string().max(512).optional(),
  }),
])

function isPublicHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }
  catch {
    return false
  }
}

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = TestSchema.parse(await readBody(event))
  const stored = await toolBackendsService.get(user.id)

  if (body.kind === 'scrapegraph') {
    const apiKey = body.apiKey?.trim() || stored.data?.scrapegraphApiKey || process.env.SGAI_API_KEY
    if (!apiKey) throw createError({ statusCode: 400, statusMessage: 'No ScrapeGraphAI API key configured' })
    const startedAt = Date.now()
    const client = await createScrapegraphClient(apiKey)
    const result = await client.credits()
    if (result.status !== 'success') {
      throw createError({ statusCode: 502, statusMessage: result.error ?? 'ScrapeGraphAI test failed' })
    }
    return { ok: true, latencyMs: Date.now() - startedAt, credits: result.data }
  }

  if (body.kind === 'langsearch') {
    const apiKey = body.apiKey?.trim() || stored.data?.langsearchApiKey || process.env.LANGSEARCH_API_KEY
    if (!apiKey) throw createError({ statusCode: 400, statusMessage: 'No LangSearch API key configured' })
    const startedAt = Date.now()
    const result = await searchLangSearch({ query: 'LangSearch Web Search API', count: 1 }, apiKey)
    if (!result.success) throw createError({ statusCode: 502, statusMessage: result.error })
    return { ok: true, latencyMs: Date.now() - startedAt, results: result.data.results.length }
  }

  const url = (body.url?.trim() || stored.data?.pythonBackendUrl || '').replace(/\/+$/, '')
  if (!url) throw createError({ statusCode: 400, statusMessage: 'No Python backend URL configured' })
  if (!isPublicHttpUrl(url)) throw createError({ statusCode: 400, statusMessage: 'Python backend URL must be http(s)' })
  const token = body.token?.trim() || stored.data?.pythonBackendToken || null

  const startedAt = Date.now()
  const result = await callPythonBackend({ url, token }, '/health', { method: 'GET' })
  if (!result.success) throw createError({ statusCode: 502, statusMessage: result.error })
  return { ok: true, latencyMs: Date.now() - startedAt, health: result.data }
})
