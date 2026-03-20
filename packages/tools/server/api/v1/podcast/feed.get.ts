import * as cheerio from 'cheerio'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const feedUrl = String(query.url || '')

  if (!feedUrl) {
    throw createError({ statusCode: 400, message: 'feedUrl is required' })
  }

  let xml: string
  try {
    xml = await $fetch<string>(feedUrl, {
      responseType: 'text',
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
  const $ = cheerio.load(xml, { xmlMode: true })
  const episodes: EpisodeItem[] = []

  $('item').each((_, el) => {
    const item = $(el)
    const enclosureUrl = item.find('enclosure').attr('url') || ''
    if (!enclosureUrl) return

    const title = item.find('title').first().text().trim() || 'Untitled Episode'
    const pubDate = item.find('pubDate').text().trim()
    const duration = getDuration(item, $)
    const description = item.find('description').first().text().trim()
      || item.find('summary').text().trim()

    episodes.push({
      id: crypto.randomUUID(),
      title,
      date: pubDate ? new Date(pubDate).toLocaleDateString() : '',
      duration: formatDuration(duration),
      audioUrl: enclosureUrl,
      description: description.replace(/<[^>]*>/g, '').slice(0, 300),
    })
  })

  return episodes
}

function getDuration(item: any, $: any): string {
  let duration = ''
  item.children().each((_: any, el: any) => {
    if (el.tagName === 'itunes:duration') {
      duration = $(el).text().trim()
    }
  })
  if (!duration) {
    duration = item.find('duration').text().trim()
  }
  return duration
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
