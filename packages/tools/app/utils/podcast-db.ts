import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface FavoritePodcast {
  id: string
  title: string
  author: string
  artwork: string
  feedUrl: string
  savedAt: number
}

interface PodcastDB extends DBSchema {
  favorites: {
    key: string
    value: FavoritePodcast
    indexes: { 'by-date': number }
  }
}

let dbPromise: Promise<IDBPDatabase<PodcastDB>>

export const initPodcastDB = (): Promise<IDBPDatabase<PodcastDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<PodcastDB>('podcast-db', 1, {
      upgrade(db: IDBPDatabase<PodcastDB>) {
        const store = db.createObjectStore('favorites', { keyPath: 'id' })
        store.createIndex('by-date', 'savedAt')
      },
    })
  }
  return dbPromise
}

export const saveFavorite = async (podcast: FavoritePodcast): Promise<void> => {
  try {
    const db = await initPodcastDB()
    await db.put('favorites', podcast)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      useToast().add({
        title: 'Storage Full',
        description: 'Cannot save favorite. Browser storage is full.',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
    } else {
      throw error
    }
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
    const result = await db.get('favorites', id)
    return !!result
  } catch {
    return false
  }
}
