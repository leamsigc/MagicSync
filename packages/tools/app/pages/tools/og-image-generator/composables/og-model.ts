export type OgPlatformKey = 'og' | 'twitter' | 'linkedin' | 'instagram-square' | 'instagram-story'

export type OgPlatform = {
  key: OgPlatformKey
  label: string
  width: number
  height: number
}

export const OG_PLATFORMS: OgPlatform[] = [
  { key: 'og', label: 'Open Graph', width: 1200, height: 630 },
  { key: 'twitter', label: 'Twitter / X', width: 1200, height: 628 },
  { key: 'linkedin', label: 'LinkedIn', width: 1200, height: 627 },
  { key: 'instagram-square', label: 'Instagram Square', width: 1080, height: 1080 },
  { key: 'instagram-story', label: 'Instagram Story', width: 1080, height: 1920 }
]

export const getPlatform = (key: OgPlatformKey): OgPlatform =>
  OG_PLATFORMS.find(p => p.key === key) || OG_PLATFORMS[0]!

export type TemplateKey = 'hero-left' | 'hero-center' | 'article' | 'quote' | 'event' | 'promo' | 'podcast' | 'announcement' | 'link-card' | 'profile'

export type TemplateDef = {
  key: TemplateKey
  label: string
  imageSlot: boolean
  avatarSlot: boolean
}

export const OG_TEMPLATES: TemplateDef[] = [
  { key: 'hero-left', label: 'Hero', imageSlot: false, avatarSlot: true },
  { key: 'hero-center', label: 'Centered', imageSlot: false, avatarSlot: false },
  { key: 'article', label: 'Article', imageSlot: true, avatarSlot: false },
  { key: 'quote', label: 'Quote', imageSlot: false, avatarSlot: true },
  { key: 'event', label: 'Event', imageSlot: false, avatarSlot: false },
  { key: 'promo', label: 'Promo', imageSlot: true, avatarSlot: false },
  { key: 'podcast', label: 'Podcast', imageSlot: true, avatarSlot: false },
  { key: 'announcement', label: 'Announcement', imageSlot: false, avatarSlot: false },
  { key: 'link-card', label: 'Link card', imageSlot: true, avatarSlot: false },
  { key: 'profile', label: 'Profile', imageSlot: false, avatarSlot: true }
]

export const templateDef = (key: TemplateKey): TemplateDef =>
  OG_TEMPLATES.find(t => t.key === key) || OG_TEMPLATES[0]!

export type BackgroundKind = 'gradient' | 'solid' | 'image'

export type OgBackground = {
  kind: BackgroundKind
  gradientFrom: string
  gradientTo: string
  solidColor: string
  imageUrl: string
  overlayOpacity: number
}

export type OgTheme = {
  textColor: string
  accentColor: string
  fontScale: number
  fontWeight: number
}

export type OgFields = {
  title: string
  tag: string
  subtitle: string
  author: string
  logoText: string
  logoUrl: string
  imageUrl: string
  avatarUrl: string
}

export type PatternKind = 'none' | 'grid' | 'dots' | 'noise'

export type OgTemplateConfig = {
  template: TemplateKey
  fields: OgFields
  background: OgBackground
  theme: OgTheme
  pattern: PatternKind
}

export type LayerType = 'text' | 'rect' | 'image'

export type OgLayer = {
  id: string
  name: string
  type: LayerType
  visible: boolean
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  content: string
  fontSize: number
  bold: boolean
  italic: boolean
  color: string
  fill: string
  radius: number
  src: string
}

export type OgDoc = {
  platform: OgPlatformKey
  templateConfig: OgTemplateConfig
  codeHtml: string
  codeCss: string
  layers: OgLayer[]
}

export const GRADIENT_PRESETS: { name: string, from: string, to: string }[] = [
  { name: 'Midnight', from: '#0f172a', to: '#334155' },
  { name: 'Violet', from: '#4c1d95', to: '#c084fc' },
  { name: 'Ocean', from: '#0c4a6e', to: '#22d3ee' },
  { name: 'Sunset', from: '#7c2d12', to: '#fbbf24' },
  { name: 'Emerald', from: '#064e3b', to: '#34d399' },
  { name: 'Rose', from: '#881337', to: '#fda4af' },
  { name: 'Slate', from: '#111827', to: '#6b7280' },
  { name: 'Cyber', from: '#1e1b4b', to: '#06b6d4' }
]

export const SOLID_PRESETS: string[] = [
  '#09090b', '#18181b', '#1e293b', '#0f172a',
  '#4c1d95', '#0c4a6e', '#064e3b', '#7c2d12',
  '#ffffff', '#f4f4f5'
]

export const defaultFields = (): OgFields => ({
  title: 'Generate Beautiful Open Graph Images',
  tag: 'Marketing',
  subtitle: 'Design social visuals in seconds, right in your browser',
  author: 'MagicSync Tools',
  logoText: 'MagicSync',
  logoUrl: '',
  imageUrl: '',
  avatarUrl: ''
})

export const defaultTemplateConfig = (): OgTemplateConfig => ({
  template: 'hero-left',
  fields: defaultFields(),
  background: {
    kind: 'gradient',
    gradientFrom: '#0f172a',
    gradientTo: '#334155',
    solidColor: '#09090b',
    imageUrl: '',
    overlayOpacity: 40
  },
  theme: {
    textColor: '#ffffff',
    accentColor: '#22d3ee',
    fontScale: 100,
    fontWeight: 700
  },
  pattern: 'grid'
})

const uid = () => Math.random().toString(36).slice(2, 10)

export const makeLayer = (partial: Partial<OgLayer>): OgLayer => ({
  id: uid(),
  name: partial.name || partial.type || 'layer',
  type: partial.type || 'text',
  visible: true,
  x: Math.round((partial.x ?? 80)),
  y: Math.round((partial.y ?? 80)),
  width: Math.round((partial.width ?? 480)),
  height: Math.round((partial.height ?? 80)),
  rotation: partial.rotation ?? 0,
  opacity: partial.opacity ?? 100,
  content: partial.content ?? 'Double-click to edit',
  fontSize: partial.fontSize ?? 64,
  bold: partial.bold ?? true,
  italic: partial.italic ?? false,
  color: partial.color ?? '#ffffff',
  fill: partial.fill ?? '#22d3ee',
  radius: partial.radius ?? 16,
  src: partial.src ?? ''
})

export const defaultLayers = (): OgLayer[] => [
  makeLayer({ type: 'rect', name: 'Backdrop', x: 0, y: 0, width: 1200, height: 630, fill: '#0f172a', radius: 0 }),
  makeLayer({ type: 'rect', name: 'Accent bar', x: 80, y: 420, width: 220, height: 14, fill: '#22d3ee', radius: 8 }),
  makeLayer({ type: 'text', name: 'Headline', x: 80, y: 180, width: 900, height: 200, content: 'Ship on-brand creatives', fontSize: 96 })
]

export const defaultCodeHtml = () => `<div class="card">
  <div class="tag">Open Source</div>
  <h1>The Open Source Firebase Alternative</h1>
  <div class="footer">
    <div class="logo">GS</div>
    <span>supabase.com</span>
  </div>
</div>`

export const defaultCodeCss = () => `* { margin: 0; padding: 0; box-sizing: border-box; }
.card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 72px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: white;
  font-family: system-ui, sans-serif;
}
.tag {
  align-self: flex-start;
  border: 1px solid rgba(255,255,255,.35);
  border-radius: 999px;
  padding: 6px 18px;
  font-size: 24px;
}
h1 { font-size: 76px; line-height: 1.1; max-width: 920px; }
.footer { display: flex; align-items: center; gap: 20px; font-size: 28px; opacity: .85; }
.logo {
  display: grid; place-items: center;
  width: 56px; height: 56px; border-radius: 12px;
  background: #34d399; color: #052e16; font-weight: 800; font-size: 26px;
}`

export const randomGradient = () => GRADIENT_PRESETS[Math.floor(Math.random() * GRADIENT_PRESETS.length)]!

export const backgroundCss = (bg: OgBackground): string => {
  if (bg.kind === 'solid') return bg.solidColor
  return `linear-gradient(135deg, ${bg.gradientFrom} 0%, ${bg.gradientTo} 100%)`
}

export const patternCss = (pattern: PatternKind): string => {
  switch (pattern) {
    case 'grid':
      return `radial-gradient(circle at 25px 25px, rgba(255,255,255,.08) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(255,255,255,.08) 2%, transparent 0%)`
    case 'dots':
      return `radial-gradient(rgba(255,255,255,.16) 1.5px, transparent 1.5px)`
    case 'noise':
      return `repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 2px, transparent 2px 4px)`
    default:
      return ''
  }
}

export const patternSize = (pattern: PatternKind): string => (pattern === 'grid' ? '100px 100px, 100px 100px' : pattern === 'dots' ? '28px 28px' : '')
