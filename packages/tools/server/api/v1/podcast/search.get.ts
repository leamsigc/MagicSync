export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const term = String(query.term || '')
  const limit = Math.min(parseInt(String(query.limit || '10')), 20)

  if (!term) {
    return { results: [] }
  }

  const iTunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=podcast&entity=podcast&limit=${limit}`

  const data = await $fetch<{ results: Record<string, unknown>[] }>(iTunesUrl, {
    headers: { Accept: 'application/json' },
  })

  const results = (data.results || []).filter((p: Record<string, unknown>) => p.feedUrl).map((p: Record<string, unknown>) => ({
    collectionId: p.collectionId,
    collectionName: p.collectionName,
    artistName: p.artistName,
    artworkUrl600: p.artworkUrl600,
    feedUrl: p.feedUrl,
  }))

  return { results }
})
