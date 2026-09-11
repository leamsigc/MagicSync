import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CarouselSlide, CarouselPalette } from '../composables/useCarouselSaveShare'
import type { SlideSceneSnapshot } from '../../shared/carousel-scene/scene-snapshot'

export interface LocalCarousel {
  id: string
  name: string
  slides: CarouselSlide[]
  palette: CarouselPalette
  pattern?: string
  handle?: string
  /** Fabric scene snapshots (Task 1.4). Additive — old rows simply lack it. */
  scene?: SlideSceneSnapshot[]
  lastModified: number
}

interface CarouselDB extends DBSchema {
  carousels: {
    key: string
    value: LocalCarousel
    indexes: { 'by-date': number }
  }
}

let dbPromise: Promise<IDBPDatabase<CarouselDB>> | null = null

export function initCarouselDB(): Promise<IDBPDatabase<CarouselDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CarouselDB>('carousel-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('carousels', { keyPath: 'id' })
        store.createIndex('by-date', 'lastModified')
      },
    })
  }
  return dbPromise
}

export async function saveLocalCarousel(carousel: Omit<LocalCarousel, 'lastModified'>): Promise<void> {
  const db = await initCarouselDB()
  await db.put('carousels', { ...carousel, lastModified: Date.now() })
}

export async function getLocalCarousel(id: string): Promise<LocalCarousel | undefined> {
  const db = await initCarouselDB()
  return db.get('carousels', id)
}

export async function getAllLocalCarousels(): Promise<LocalCarousel[]> {
  const db = await initCarouselDB()
  return db.getAllFromIndex('carousels', 'by-date')
}

export async function deleteLocalCarousel(id: string): Promise<void> {
  const db = await initCarouselDB()
  await db.delete('carousels', id)
}
