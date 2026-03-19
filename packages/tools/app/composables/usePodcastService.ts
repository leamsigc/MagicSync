export interface PodcastResult {
  id: number
  title: string
  author: string
  artwork: string
  feedUrl: string
}

export interface Episode {
  id: string
  title: string
  date: string
  duration: string
  audioUrl: string
  description: string
}

export const usePodcastService = () => {
  const searchPodcasts = async (term: string, limit = 10): Promise<PodcastResult[]> => {
    if (!term.trim()) return []
    try {
      const data = await $fetch<{ results: Array<{ collectionId: number; collectionName: string; artistName: string; artworkUrl600: string; feedUrl: string }> }>(
        '/api/v1/podcast/search',
        { query: { term: term.trim(), limit } }
      )
      return (data.results || []).map((p) => ({
        id: p.collectionId,
        title: p.collectionName || 'Unknown Podcast',
        author: p.artistName || 'Unknown Author',
        artwork: p.artworkUrl600 || '',
        feedUrl: p.feedUrl || '',
      }))
    } catch {
      useToast().add({
        title: 'Search Unavailable',
        description: 'Could not search podcasts. Please try again.',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
      return []
    }
  }

  const getPodcastFeed = async (feedUrl: string): Promise<Episode[]> => {
    if (!feedUrl) return []
    try {
      const data = await $fetch<{ episodes: Episode[] }>('/api/v1/podcast/feed', {
        query: { url: feedUrl },
      })
      return data.episodes || []
    } catch {
      useToast().add({
        title: 'Unable to Load Podcasts',
        description: 'Could not load podcast episodes. Please try again.',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
      return []
    }
  }

  return {
    searchPodcasts,
    getPodcastFeed,
  }
}
