export interface MenuPage {
  id: string
  name: string
  type: 'html' | 'image'
  content: string
  isActive: boolean
  order: number
}

export interface MenuBoardSettings {
  transitionTime: number
  isLocked: boolean
  unlockPin: string
}

export interface MenuBoard {
  id: string
  name: string
  pages: MenuPage[]
  settings: MenuBoardSettings
  lastModified?: number
  isPublic?: boolean
}

export interface BoardTemplate {
  id: string
  name: string
  content: string
}

export const DEFAULT_BOARD_SETTINGS: MenuBoardSettings = {
  transitionTime: 10,
  isLocked: false,
  unlockPin: '0000',
}

export function sortActivePages(pages: MenuPage[]): MenuPage[] {
  return pages.filter(p => p.isActive).sort((a, b) => a.order - b.order)
}
