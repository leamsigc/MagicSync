import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { isSafeExternalUrl } from '#layers/BaseShared/server/utils/ssrf'

const MAX_REFERENCE_URLS = 10

interface ResearchRequest {
  businessId?: unknown
  brief?: unknown
  referenceUrls?: unknown
}

interface ReferenceResult {
  url: string
  warning?: string
}

function parseReferenceUrls(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(url => typeof url !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'referenceUrls must be an array of URLs' })
  }
  if (value.length > MAX_REFERENCE_URLS) {
    throw createError({ statusCode: 400, statusMessage: `referenceUrls supports up to ${MAX_REFERENCE_URLS} URLs` })
  }
  return value
}

async function inspectReferences(urls: string[]): Promise<ReferenceResult[]> {
  return Promise.all(urls.map(async (url) => {
    const safety = await isSafeExternalUrl(url)
    return safety.safe
      ? { url }
      : { url, warning: `Blocked URL: ${url} (${safety.reason})` }
  }))
}

export default defineEventHandler(async (event) => {
  await checkUserIsLogin(event)
  const body = await readBody<ResearchRequest>(event)
  const brief = typeof body?.brief === 'string' ? body.brief.trim() : ''
  if (!brief) {
    throw createError({ statusCode: 400, statusMessage: 'brief is required' })
  }
  if (typeof body.businessId !== 'string' || !body.businessId) {
    throw createError({ statusCode: 400, statusMessage: 'businessId is required' })
  }

  const references = await inspectReferences(parseReferenceUrls(body.referenceUrls))
  return {
    researchId: `res-${crypto.randomUUID()}`,
    sources: references.filter(reference => !reference.warning).map(reference => ({ url: reference.url })),
    warnings: references.flatMap(reference => reference.warning ? [reference.warning] : []),
  }
})
