export interface MenuPage {
  id: string
  name: string
  type: 'html' | 'image'
  content: string
  isActive: boolean
  order: number
}

export type TvDisplaySize = 'hd' | 'fhd' | 'qhd' | 'uhd' | 'ultrawide' | 'portrait'

export interface TvDisplaySizeOption {
  key: TvDisplaySize
  label: string
  width: number
  height: number
}

export const TV_DISPLAY_SIZES: TvDisplaySizeOption[] = [
  { key: 'hd', label: 'HD Ready (1280×720)', width: 1280, height: 720 },
  { key: 'fhd', label: 'Full HD (1920×1080)', width: 1920, height: 1080 },
  { key: 'qhd', label: 'Quad HD (2560×1440)', width: 2560, height: 1440 },
  { key: 'uhd', label: '4K UHD (3840×2160)', width: 3840, height: 2160 },
  { key: 'ultrawide', label: 'Ultrawide (2560×1080)', width: 2560, height: 1080 },
  { key: 'portrait', label: 'Portrait (1080×1920)', width: 1080, height: 1920 },
]

export function getDisplaySize(key: TvDisplaySize): TvDisplaySizeOption {
  return TV_DISPLAY_SIZES.find(s => s.key === key) ?? TV_DISPLAY_SIZES[1]!
}

export interface MenuBoardSettings {
  transitionTime: number
  isLocked: boolean
  unlockPin: string
  /** Target TV resolution — content renders at this size and scales to fit the screen. */
  displaySize: TvDisplaySize
  /** Physical TV diagonal in inches — informational, used in previews. */
  tvInches?: number
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
  displaySize: 'fhd',
}

export function sortActivePages(pages: MenuPage[]): MenuPage[] {
  return pages.filter(p => p.isActive).sort((a, b) => a.order - b.order)
}
