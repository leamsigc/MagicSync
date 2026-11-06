import { z } from 'zod'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { safeFetch } from '#layers/BaseShared/server/utils/ssrf'

/**
 * Stock photo/video search across Pexels + Unsplash through their already
 * existing HTTP routes (keeps keys + proxy logic server-side in one place).
 */

export default defineMcpTool({
  description: 'Search stock photos (Pexels + Unsplash) and Pexels videos for design backgrounds or field values (image_url). Returns direct CDN URLs usable in dynamic_fields.image_url.',
  inputSchema: {
    query: z.string().min(1).max(120).describe('What to search for'),
    kind: z.enum(['photo', 'video']).default('photo'),
    provider: z.enum(['pexels', 'unsplash', 'any']).default('any'),
    limit: z.number().int().min(1).max(15).default(6),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'read')
    const userId = await resolveUserId(mcp)

    try {
      const perProvider = Math.ceil(args.limit / (args.provider === 'any' ? 2 : 1))
      const wantsPhotos = args.kind === 'photo'
      const wantsVideos = args.kind === 'video'

      const jobs: Array<Promise<unknown[]>> = []
      if (args.kind === 'photo' && args.provider !== 'unsplash') {
        jobs.push(searchJson(`/api/v1/assets/pexel?query=${encodeURIComponent(args.query)}&per_page=${perProvider}`))
      } else if (args.kind === 'video' && args.provider !== 'unsplash') {
        jobs.push(searchJson(`/api/v1/assets/pexel/videos?query=${encodeURIComponent(args.query)}&per_page=${perProvider}`))
      }
      if (wantsPhotos && args.provider !== 'pexels') {
        jobs.push(searchJson(`/api/v1/assets/unsplash?query=${encodeURIComponent(args.query)}&per_page=${perProvider}`))
      }
      if (jobs.length === 0) return { message: 'Nothing to search for that kind/provider combination.', results: [] }

      const settled = await Promise.allSettled(jobs)
      const results = settled.flatMap(entry => (entry.status === 'fulfilled' ? entry.value : []))
      logMcpCall('search-design-stock', { userId, query: args.query, results: results.length })
      if (results.length === 0) {
        throw new Error('No stock results (check that PEXELS/UNSPLASH keys are configured and the query is reasonable).')
      }
      return {
        count: results.length,
        results: results.slice(0, args.limit).map(entry => {
          const item = entry as { id?: number | string; src?: { large?: string; original?: string; medium?: string }; video?: Array<{ link?: string; type?: string }>; alt?: string; photographer?: string; image?: string }
          const videoLink = item.video?.find(entry => entry.type === 'mp4')?.link ?? item.video?.[0]?.link
          return {
            id: String(item.id ?? ''),
            kind: videoLink ? 'video' : 'photo',
            url: videoLink ?? item.src?.large ?? item.src?.medium ?? item.src?.original ?? item.image ?? '',
            alt: item.alt ?? '',
            photographer: item.photographer ?? '',
          }
        }).filter(entry => entry.url.length > 0),
      }
    } catch (error) {
      log.error({ message: 'search-design-stock failed', error: String(error) })
      throw error instanceof Error ? error : new Error('Stock search failed')
    }
  },
})

async function searchJson(path: string): Promise<unknown[]> {
  const origin = process.env.NUXT_APP_URL ?? `http://localhost:${Number(process.env.PORT ?? 3000)}`
  const response = await safeFetch(`${origin.replace(/\/$/, '')}${path}`, { timeoutMs: 15_000, maxBytes: 2_000_000 })
  if (response.status < 200 || response.status >= 300) return []
  const payload = JSON.parse(String(response.body)) as { photos?: unknown[]; videos?: unknown[]; results?: unknown[] }
  return payload.photos ?? payload.videos ?? []
}
