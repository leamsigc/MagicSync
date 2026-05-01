export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const query = getQuery(event)
  const term = String(query.term || '')
  const limit = Math.min(parseInt(String(query.limit || '10')), 20)

  log.set({ searchTerm: term, limit })

  if (!term) {
    log.info('Empty search term, returning empty results', {})
    return { results: [] }
  }

  log.info('Searching podcasts', { term, limit })

  const iTunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=podcast&entity=podcast&limit=${limit}`

  const requestSting = await $fetch<{ results: Record<string, unknown>[] }>(iTunesUrl, {
    headers: { Accept: 'application/json' },
  });

  const data = JSON.parse((requestSting as unknown as string) || '{}')


  const results = (data.results || []).filter((p: Record<string, unknown>) => {
    return p.feedUrl
  }).map((p: Record<string, unknown>) => ({
    collectionId: p.collectionId,
    collectionName: p.collectionName,
    artistName: p.artistName,
    artworkUrl600: p.artworkUrl600,
    feedUrl: p.feedUrl,
  }))

  log.info('Podcast search completed', { term, resultsCount: results.length })
  return { results }
})
