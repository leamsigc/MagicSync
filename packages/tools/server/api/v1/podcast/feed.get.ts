export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const feedUrl = String(query.url || '')

  if (!feedUrl) {
    throw createError({ statusCode: 400, message: 'feedUrl is required' })
  }

  let xml: string
  try {
    xml = await $fetch<string>(feedUrl, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    })
  } catch {
    throw createError({ statusCode: 502, message: 'Failed to fetch podcast feed' })
  }

  const episodes = parseRSS(xml)
  return { episodes }
})

interface EpisodeItem {
  id: string
  title: string
  date: string
  duration: string
  audioUrl: string
  description: string
}

function parseRSS(xml: string): EpisodeItem[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) {
    throw createError({ statusCode: 422, message: 'Invalid feed format' })
  }

  const items = doc.querySelectorAll('item')
  const episodes: EpisodeItem[] = []
  for (let i = 0; i < Math.min(items.length, 5); i++) {
    const item = items[i]
    const enclosure = item.querySelector('enclosure')
    const audioUrl = enclosure?.getAttribute('url') || ''
    if (!audioUrl) continue

    const title = item.querySelector('title')?.textContent?.trim() || `Episode ${i + 1}`
    const pubDate = item.querySelector('pubDate')?.textContent?.trim() || ''
    const duration = item.querySelector('itunes\\:duration, duration')?.textContent?.trim() || ''
    const description = item.querySelector('description, itunes\\:summary')?.textContent?.trim() || ''

    episodes.push({
      id: crypto.randomUUID(),
      title,
      date: pubDate ? new Date(pubDate).toLocaleDateString() : '',
      duration: formatDuration(duration),
      audioUrl,
      description: description.replace(/<[^>]*>/g, '').slice(0, 300),
    })
  }
  return episodes
}

function formatDuration(raw: string): string {
  if (!raw) return ''
  const parts = raw.split(':').map(Number)
  if (parts.length === 3) {
    const [h, m, s] = parts
    return `${h}h ${m}m`
  }
  if (parts.length === 2) {
    const [m, s] = parts
    return `${m}m ${s}s`
  }
  const totalSecs = parseInt(raw, 10)
  if (!isNaN(totalSecs)) {
    const h = Math.floor(totalSecs / 3600)
    const m = Math.floor((totalSecs % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }
  return raw
}
