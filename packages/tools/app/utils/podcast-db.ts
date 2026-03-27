import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Episode } from '../composables/usePodcastService'

export interface FavoritePodcast {
  id: string
  title: string
  author: string
  artwork: string
  feedUrl: string
  savedAt: number
  episodes?: Episode[]
}

export interface DownloadedEpisode {
  id: string
  podcastId: string
  title: string
  date: string
  duration: string
  audioUrl: string
  description: string
  audioBlob: Blob
  downloadedAt: number
}

export interface PlayedEpisode {
  id: string
  podcastId: string
  playedAt: number
}

interface PodcastDB extends DBSchema {
  favorites: {
    key: string
    value: FavoritePodcast
    indexes: { 'by-date': number }
  }
  downloads: {
    key: string
    value: DownloadedEpisode
    indexes: { 'by-podcast': string; 'by-date': number }
  }
  played: {
    key: string
    value: PlayedEpisode
    indexes: { 'by-podcast': string }
  }
}

let dbPromise: Promise<IDBPDatabase<PodcastDB>>

export const initPodcastDB = (): Promise<IDBPDatabase<PodcastDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<PodcastDB>('podcast-db', 3, {
      upgrade(db: IDBPDatabase<PodcastDB>, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('favorites', { keyPath: 'id' })
          store.createIndex('by-date', 'savedAt')
        }
        if (oldVersion < 2) {
          const dlStore = db.createObjectStore('downloads', { keyPath: 'id' })
          dlStore.createIndex('by-podcast', 'podcastId')
          dlStore.createIndex('by-date', 'downloadedAt')
        }
        if (oldVersion < 3) {
          const playedStore = db.createObjectStore('played', { keyPath: 'id' })
          playedStore.createIndex('by-podcast', 'podcastId')
        }
      },
    })
  }
  return dbPromise
}

const handleStorageError = (error: unknown, action: string) => {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    useToast().add({
      title: 'Storage Full',
      description: `Cannot ${action}. Browser storage is full.`,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } else {
    throw error
  }
}

export const saveFavorite = async (podcast: FavoritePodcast): Promise<void> => {
  try {
    const db = await initPodcastDB()
    await db.put('favorites', podcast)
  } catch (error) {
    handleStorageError(error, 'save favorite')
  }
}

export const removeFavorite = async (id: string): Promise<void> => {
  const db = await initPodcastDB()
  await db.delete('favorites', id)
}

export const getFavorites = async (): Promise<FavoritePodcast[]> => {
  try {
    const db = await initPodcastDB()
    return db.getAllFromIndex('favorites', 'by-date')
  } catch {
    return []
  }
}

export const isFavorite = async (id: string): Promise<boolean> => {
  try {
    const db = await initPodcastDB()
    return !!(await db.get('favorites', id))
  } catch {
    return false
  }
}

export const savePodcast = async (podcast: FavoritePodcast): Promise<void> => {
  try {
    const db = await initPodcastDB()
    const existing = await db.get('favorites', podcast.id)
    if (existing) {
      existing.savedAt = Date.now()
      existing.episodes = podcast.episodes
      await db.put('favorites', existing)
      return
    }
    await db.put('favorites', podcast)
  } catch (error) {
    handleStorageError(error, 'save podcast')
  }
}

export const getPodcastsById = async (id: string): Promise<FavoritePodcast | undefined> => {
  try {
    const db = await initPodcastDB()
    return db.get('favorites', id)
  } catch {
    return undefined
  }
}

export const downloadEpisode = async (
  episode: Episode,
  podcastId: string,
  proxiedUrl: string
): Promise<boolean> => {
  try {
    const res = await fetch(proxiedUrl)
    if (!res.ok) {
      useToast().add({
        title: 'Download Failed',
        description: 'Could not download this episode.',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
      return false
    }
    const blob = await res.blob()
    const db = await initPodcastDB()
    await db.put('downloads', {
      id: episode.id,
      podcastId,
      title: episode.title,
      date: episode.date,
      duration: episode.duration,
      audioUrl: episode.audioUrl,
      description: episode.description,
      audioBlob: blob,
      downloadedAt: Date.now(),
    })
    useToast().add({
      title: 'Episode Saved',
      description: `"${episode.title}" saved for offline listening.`,
      color: 'success',
      icon: 'i-lucide-download',
    })
    return true
  } catch (error) {
    handleStorageError(error, 'download episode')
    return false
  }
}

export const removeDownload = async (episodeId: string): Promise<void> => {
  const db = await initPodcastDB()
  await db.delete('downloads', episodeId)
}

export const getDownload = async (episodeId: string): Promise<DownloadedEpisode | undefined> => {
  try {
    const db = await initPodcastDB()
    return db.get('downloads', episodeId)
  } catch {
    return undefined
  }
}

export const getDownloadsForPodcast = async (podcastId: string): Promise<DownloadedEpisode[]> => {
  try {
    const db = await initPodcastDB()
    return db.getAllFromIndex('downloads', 'by-podcast', podcastId)
  } catch {
    return []
  }
}

export const isEpisodeDownloaded = async (episodeId: string): Promise<boolean> => {
  try {
    const db = await initPodcastDB()
    return !!(await db.get('downloads', episodeId))
  } catch {
    return false
  }
}

export const getDownloadUrl = (blob: Blob): string => URL.createObjectURL(blob)

export const markPlayed = async (episodeId: string, podcastId: string): Promise<void> => {
  try {
    const db = await initPodcastDB()
    await db.put('played', { id: episodeId, podcastId, playedAt: Date.now() })
  } catch {
    // Silently ignore — played tracking is non-critical
  }
}

export const isEpisodePlayed = async (episodeId: string): Promise<boolean> => {
  try {
    const db = await initPodcastDB()
    return !!(await db.get('played', episodeId))
  } catch {
    return false
  }
}

export const getPlayedEpisodes = async (podcastId: string): Promise<PlayedEpisode[]> => {
  try {
    const db = await initPodcastDB()
    return db.getAllFromIndex('played', 'by-podcast', podcastId)
  } catch {
    return []
  }
}
