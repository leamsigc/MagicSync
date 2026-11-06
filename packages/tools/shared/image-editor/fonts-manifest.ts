/**
 * Curated font manifest for the design studio. Fonts live at
 * `packages/tools/assets/fonts/<family>/<file>` (node render) and are copied
 * to `packages/site/public/fonts/<family>/<file>` (browser FontFace loader)
 * by `packages/tools/scripts/download-fonts.mjs` (`pnpm fonts:assets`).
 */

export interface FontManifestEntry {
  family: string
  /** Display name for the font picker. */
  label: string
  category: 'sans' | 'serif' | 'display' | 'handwriting'
  files: Array<{ file: string; weight: number; style: string }>
  source: 'google'
  sourceUrl: string
}

export const FONT_MANIFEST: FontManifestEntry[] = [
  {
    family: 'ZCOOL KuaiLe', label: 'ZCOOL KuaiLe', category: 'display',
    files: [{ file: 'ZCOOLKuaiLe-Regular.ttf', weight: 400, style: 'normal' }],
    source: 'google', sourceUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf',
  },
  {
    family: 'ZCOOL QingKe HuangYou', label: 'ZCOOL QingKe HuangYou', category: 'display',
    files: [{ file: 'ZCOOLQingKeHuangYou-Regular.ttf', weight: 400, style: 'normal' }],
    source: 'google', sourceUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf',
  },
  {
    family: 'Ma Shan Zheng', label: 'Ma Shan Zheng', category: 'handwriting',
    files: [{ file: 'MaShanZheng-Regular.ttf', weight: 400, style: 'normal' }],
    source: 'google', sourceUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf',
  },
  {
    family: 'Noto Sans SC', label: 'Noto Sans SC', category: 'sans',
    files: [{ file: 'NotoSansSC-Regular.ttf', weight: 400, style: 'normal' }],
    source: 'google', sourceUrl: 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/Mono/NotoSansSC-Regular.otf',
  },
  {
    family: 'Archivo Black', label: 'Archivo Black', category: 'display',
    files: [{ file: 'ArchivoBlack-Regular.ttf', weight: 400, style: 'normal' }],
    source: 'google', sourceUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/archivoblack/ArchivoBlack-Regular.ttf',
  },
  {
    family: 'Anton', label: 'Anton', category: 'display',
    files: [{ file: 'Anton-Regular.ttf', weight: 400, style: 'normal' }],
    source: 'google', sourceUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf',
  },
  {
    family: 'Bebas Neue', label: 'Bebas Neue', category: 'display',
    files: [{ file: 'BebasNeue-Regular.ttf', weight: 400, style: 'normal' }],
    source: 'google', sourceUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/BebasNeue-Regular.ttf',
  },
  {
    family: 'Lobster', label: 'Lobster', category: 'display',
    files: [{ file: 'Lobster-Regular.ttf', weight: 400, style: 'normal' }],
    source: 'google', sourceUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/lobster/Lobster-Regular.ttf',
  },
  {
    family: 'Pacifico', label: 'Pacifico', category: 'handwriting',
    files: [{ file: 'Pacifico-Regular.ttf', weight: 400, style: 'normal' }],
    source: 'google', sourceUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/pacifico/Pacifico-Regular.ttf',
  },
  {
    family: 'Abril Fatface', label: 'Abril Fatface', category: 'display',
    files: [{ file: 'AbrilFatface-Regular.ttf', weight: 400, style: 'normal' }],
    source: 'google', sourceUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/abrilfatface/AbrilFatface-Regular.ttf',
  },
  {
    family: 'Righteous', label: 'Righteous', category: 'display',
    files: [{ file: 'Righteous-Regular.ttf', weight: 400, style: 'normal' }],
    source: 'google', sourceUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/righteous/Righteous-Regular.ttf',
  },
  {
    family: 'Alfa Slab One', label: 'Alfa Slab One', category: 'display',
    files: [{ file: 'AlfaSlabOne-Regular.ttf', weight: 400, style: 'normal' }],
    source: 'google', sourceUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/alfaslabone/AlfaSlabOne-Regular.ttf',
  },
  {
    family: 'DejaVu Sans', label: 'DejaVu Sans', category: 'sans',
    files: [{ file: 'DejaVuSans.ttf', weight: 400, style: 'normal' }],
    source: 'google',
    sourceUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf',
  },
]

export const FONT_PAIRS: Array<{ name: string; heading: string; body: string }> = [
  // Latin pairs use a system body: loading a CJK family (hundreds of unicode
  // ranges) just for “Body text” made the canvas feel unresponsive.
  { name: 'Bold crash', heading: 'Archivo Black', body: 'Arial' },
  { name: 'Poster', heading: 'Anton', body: 'Arial' },
  { name: 'Neon night', heading: 'Bebas Neue', body: 'Arial' },
  { name: 'Sweet shop', heading: 'Lobster', body: 'Arial' },
  { name: 'Beach day', heading: 'Pacifico', body: 'Arial' },
  { name: 'Fashion mag', heading: 'Abril Fatface', body: 'Arial' },
  { name: 'Retro glow', heading: 'Righteous', body: 'Arial' },
  { name: 'Heavy craft', heading: 'Alfa Slab One', body: 'Arial' },
  // CJK pairs keep the CJK body deliberately.
  { name: 'Festival CJK', heading: 'ZCOOL KuaiLe', body: 'Noto Sans SC' },
  { name: 'Ink brush CJK', heading: 'Ma Shan Zheng', body: 'Noto Sans SC' },
  { name: 'Street CJK', heading: 'ZCOOL QingKe HuangYou', body: 'Noto Sans SC' },
  { name: 'Mono meeting', heading: 'DejaVu Sans', body: 'Arial' },
]
export const FONT_DIRS_ASSETS = 'packages/tools/assets/fonts'
export const FONT_DIRS_PUBLIC = 'packages/site/public/fonts'
