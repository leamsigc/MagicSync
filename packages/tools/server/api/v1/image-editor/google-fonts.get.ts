const CACHE_TTL = 24 * 60 * 60 * 1000

interface FontFamily {
  family: string
  category: string
}

let cache: { at: number; families: FontFamily[] } | null = null

/**
 * Google Fonts catalog proxy — the metadata endpoint is public but is served
 * from fonts.google.com (CORS-blocked in the browser), so it is proxied here
 * and cached for a day. Returns the full family list (~1,900 entries), not a
 * curated shortlist.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  if (cache && Date.now() - cache.at < CACHE_TTL) {
    return { families: cache.families, cached: true }
  }

  try {
    const raw = await $fetch<{ familyMetadataList?: Array<{ family: string; category?: string }> }>(
      'https://fonts.google.com/metadata/fonts',
      { timeout: 15_000, retry: 1 },
    )
    const families = (raw.familyMetadataList ?? [])
      .map(entry => ({ family: entry.family, category: entry.category ?? 'Sans Serif' }))
      .filter(entry => entry.family.length > 0)
      .sort((a, b) => a.family.localeCompare(b.family))
    cache = { at: Date.now(), families }
    log.set({ families: families.length })
    return { families, cached: false }
  } catch (error) {
    log.error({ message: 'Google Fonts catalog fetch failed', error: String(error) })
    return { families: cache?.families ?? [], cached: Boolean(cache) }
  }
})
