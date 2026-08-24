import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { MenuBoard } from '../pages/tools/menu-board/types'

interface MenuBoardDB extends DBSchema {
  boards: {
    key: string
    value: MenuBoard
    indexes: { 'by-date': number }
  }
}

let dbPromise: Promise<IDBPDatabase<MenuBoardDB>> | null = null

export function initMenuBoardDB(): Promise<IDBPDatabase<MenuBoardDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MenuBoardDB>('menu-board-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('boards', { keyPath: 'id' })
        store.createIndex('by-date', 'lastModified')
      },
    })
  }
  return dbPromise
}

export async function saveLocalBoard(board: MenuBoard): Promise<void> {
  const db = await initMenuBoardDB()
  await db.put('boards', { ...board, lastModified: Date.now() })
}

export async function getLocalBoard(id: string): Promise<MenuBoard | undefined> {
  const db = await initMenuBoardDB()
  return db.get('boards', id)
}

export async function getAllLocalBoards(): Promise<MenuBoard[]> {
  const db = await initMenuBoardDB()
  return db.getAllFromIndex('boards', 'by-date')
}

export async function deleteLocalBoard(id: string): Promise<void> {
  const db = await initMenuBoardDB()
  await db.delete('boards', id)
}
