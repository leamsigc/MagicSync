export interface SlideData {
  kicker?: string
  headline: string
  body?: string
  items?: string[]
  quote?: string
  author?: string
  stat?: string
  statLabel?: string
  cta?: string
  footer?: string
  images?: string[]
  borderRadius?: number
}

export interface SlidePalette {
  bg: string
  text: string
  accent: string
  patternColor: string
  font?: string
}

export const FONT_STACKS: Record<string, string> = {
  'Arial': "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
  'Arial Black': "'Arial Black', 'Arial Bold', Gadget, sans-serif",
  'Impact': "Impact, Haettenschweiler, 'Franklin Gothic Bold', 'Arial Narrow Bold', sans-serif",
  'Georgia': "Georgia, 'Times New Roman', Times, serif",
  'Courier New': "'Courier New', Courier, 'Lucida Console', monospace",
  'Verdana': "Verdana, Geneva, Tahoma, sans-serif",
  'Trebuchet MS': "'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', sans-serif",
  'Comic Sans MS': "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive",
  'Palatino': "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
  'Century Gothic': "'Century Gothic', CenturyGothic, AppleGothic, Futura, sans-serif",
  'Brush Script MT': "'Brush Script MT', 'Segoe Script', 'Bradley Hand', cursive",
}

export function fontFamilyStack(name?: string): string {
  if (!name) return ''
  const clean = name.replace(/['"]/g, '')
  return FONT_STACKS[clean] ?? `'${clean}', sans-serif`
}

export interface ImageTransform {
  x: number
  y: number
  scale: number
}

export interface BgImageLayer {
  url: string
  dim: number
  shadow: { x: number, y: number, blur: number, opacity: number }
  transform?: ImageTransform
}

export interface DeckFlow {
  mode: 'off' | 'pan' | 'plane'
  panCount: number
  image: string
  gradientFrom: string
  gradientTo: string
  dim: number
}

export const DEFAULT_FLOW: DeckFlow = {
  mode: 'off',
  panCount: 2,
  image: '',
  gradientFrom: '#0f0e0d',
  gradientTo: '#f97316',
  dim: 0,
}

export interface PalettePreset {
  name: string
  bg: string
  text: string
  accent: string
}

export const PALETTES: PalettePreset[] = [
  { name: 'Midnight', bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316' },
  { name: 'Paper', bg: '#fafaf7', text: '#1c1917', accent: '#ea580c' },
  { name: 'Ocean', bg: '#0c1e35', text: '#e0f2fe', accent: '#38bdf8' },
  { name: 'Forest', bg: '#0d1f16', text: '#dcfce7', accent: '#4ade80' },
  { name: 'Grape', bg: '#1e1035', text: '#f3e8ff', accent: '#c084fc' },
  { name: 'Candy', bg: '#fdf2f8', text: '#831843', accent: '#ec4899' },
  { name: 'Carbon', bg: '#171717', text: '#e5e5e5', accent: '#22d3ee' },
  { name: 'Sunrise', bg: '#fff7ed', text: '#7c2d12', accent: '#f59e0b' },
]

export interface CarouselTemplate {
  key: string
  title: string
  description: string
  render: (data: SlideData, palette: SlidePalette, index: number, total: number, bgImage?: BgImageLayer) => string
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function toArray(items: unknown): string[] {
  if (Array.isArray(items)) return items.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
  if (typeof items === 'string' && items.trim()) return items.split('\n').map(s => s.trim()).filter(Boolean)
  return []
}

function toImagesArray(items: unknown): string[] {
  if (Array.isArray(items)) return items.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
  if (typeof items === 'string' && items.trim()) return items.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
  return []
}

function imageTransformStyle(t?: ImageTransform): string {
  if (!t) return ''
  return `transform:translate(${t.x}px, ${t.y}px) scale(${t.scale});transform-origin:center;`
}

function bgLayer(palette: SlidePalette, bgImage?: BgImageLayer): string {
  if (!bgImage?.url) {
    return `<div data-image-slot="bg" data-image-empty="bg" style="position:absolute;inset:0;background:${esc(palette.bg)};display:flex;align-items:center;justify-content:center;cursor:pointer"><span data-empty-label style="font-size:28px;opacity:0.35">+ Add image</span></div>`
  }
  const s = bgImage.shadow
  const shadow = `drop-shadow(${s.x}px ${s.y}px ${s.blur}px rgba(0,0,0,${s.opacity}))`
  const tf = imageTransformStyle(bgImage.transform)
  return `<div data-image-slot="bg" style="position:absolute;inset:0;background:${esc(palette.bg)};overflow:hidden;cursor:move">
    <img data-image="bg" src="${esc(bgImage.url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:${shadow};${tf}" draggable="false">
    <div style="position:absolute;inset:0;background:rgba(0,0,0,${bgImage.dim});pointer-events:none"></div>
  </div>`
}

function patternLayer(patternHtml: string): string {
  return `<div style="position:absolute;inset:0;pointer-events:none">${patternHtml}</div>`
}

export const FRAME_W = 1080

/**
 * Deck-wide background layer.
 * - plane: one continuous plane (gradient or image) stretched across the whole
 *   deck and offset per slide, so it continues across a swipe instead of
 *   restarting on every frame.
 * - pan: slices cut from one wide shot — a run of slides after the cover each
 *   hold the next slice of the image.
 */
export function flowLayer(flow: DeckFlow, index: number, total: number): string {
  if (flow.mode === 'plane') {
    const deckWidth = FRAME_W * Math.max(total, 1)
    const inner = flow.image
      ? `<img src="${esc(flow.image)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" draggable="false">`
      : `<div style="position:absolute;inset:0;background:linear-gradient(90deg, ${esc(flow.gradientFrom)}, ${esc(flow.gradientTo)})"></div>`
    return `<div style="position:absolute;inset:0;overflow:hidden">
      <div style="position:absolute;top:0;left:${-FRAME_W * index}px;width:${deckWidth}px;height:100%">${inner}</div>
      <div style="position:absolute;inset:0;background:rgba(0,0,0,${flow.dim})"></div>
    </div>`
  }

  if (flow.mode === 'pan') {
    const count = Math.min(Math.max(flow.panCount, 2), 4, Math.max(total - 1, 0))
    const start = 1
    if (!flow.image || count < 2 || index < start || index >= start + count) return ''
    const deckWidth = FRAME_W * count
    return `<div style="position:absolute;inset:0;overflow:hidden">
      <div style="position:absolute;top:0;left:${-FRAME_W * (index - start)}px;width:${deckWidth}px;height:100%">
        <img src="${esc(flow.image)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" draggable="false">
      </div>
      <div style="position:absolute;inset:0;background:rgba(0,0,0,${flow.dim})"></div>
    </div>`
  }

  return ''
}

function pageFooter(palette: SlidePalette, index: number, total: number, footer?: string): string {
  const fontCss = palette.font ? `font-family:${fontFamilyStack(palette.font)};` : ''
  return `<div style="position:absolute;left:64px;right:64px;bottom:44px;display:flex;justify-content:space-between;align-items:center;font-size:22px;letter-spacing:0.12em;text-transform:uppercase;${fontCss}color:${esc(palette.text)};opacity:0.55">
    <span>${esc(footer ?? '')}</span>
    <span style="font-variant-numeric:tabular-nums">${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
  </div>`
}

function accentBar(palette: SlidePalette): string {
  return `<div style="width:96px;height:8px;background:${esc(palette.accent)};border-radius:9999px"></div>`
}

export const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  {
    key: 'title-kicker',
    title: 'Title & Kicker',
    description: 'Kicker line with a big headline and subtitle',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;gap:36px;padding:96px 80px 140px;color:${esc(p.text)};text-align:left">
        ${accentBar(p)}
        ${d.kicker ? `<div style="font-size:26px;letter-spacing:0.28em;text-transform:uppercase;color:${esc(p.accent)};font-weight:600">${esc(d.kicker)}</div>` : ''}
        <div style="font-size:96px;line-height:1.05;font-weight:800;letter-spacing:-0.02em">${esc(d.headline)}</div>
        ${d.body ? `<div style="font-size:34px;line-height:1.45;opacity:0.8">${esc(d.body)}</div>` : ''}
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'big-statement',
    title: 'Big Statement',
    description: 'One bold idea filling the slide',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;align-items:center;padding:100px 84px 140px;color:${esc(p.text)}">
        <div style="font-size:104px;line-height:1.08;font-weight:800;letter-spacing:-0.03em">${esc(d.headline)}</div>
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'tips-list',
    title: 'Tips List',
    description: 'Numbered tips for educational posts',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;gap:40px;padding:96px 80px 140px;color:${esc(p.text)}">
        ${d.kicker ? `<div style="font-size:24px;letter-spacing:0.24em;text-transform:uppercase;color:${esc(p.accent)};font-weight:600">${esc(d.kicker)}</div>` : ''}
        <div style="font-size:58px;font-weight:800;line-height:1.1">${esc(d.headline)}</div>
        <ol style="display:flex;flex-direction:column;gap:28px;font-size:32px;line-height:1.4">
          ${toArray(d.items).map((item, idx) => `
            <li style="display:flex;gap:24px;align-items:flex-start">
              <span style="flex-shrink:0;width:56px;height:56px;border-radius:16px;background:${esc(p.accent)};color:${esc(p.bg)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:26px">${idx + 1}</span>
              <span style="padding-top:8px">${esc(item)}</span>
            </li>`).join('')}
        </ol>
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'quote',
    title: 'Quote',
    description: 'Centered quote with attribution',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:44px;padding:96px 90px 140px;color:${esc(p.text)}">
        <div style="font-size:150px;line-height:0.5;color:${esc(p.accent)};font-family:Georgia,serif">&ldquo;</div>
        <div style="font-size:60px;line-height:1.25;font-weight:700">${esc(d.quote ?? d.headline)}</div>
        ${d.author ? `<div style="font-size:28px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.7">&mdash; ${esc(d.author)}</div>` : ''}
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'stat-highlight',
    title: 'Stat Highlight',
    description: 'Giant number with a supporting label',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:28px;padding:96px 80px 140px;color:${esc(p.text)}">
        <div style="font-size:220px;font-weight:800;letter-spacing:-0.04em;line-height:1;color:${esc(p.accent)}">${esc(d.stat ?? '')}</div>
        <div style="font-size:40px;font-weight:600;max-width:760px;line-height:1.35">${esc(d.statLabel ?? d.headline)}</div>
        ${d.body ? `<div style="font-size:28px;opacity:0.75;max-width:680px;line-height:1.45">${esc(d.body)}</div>` : ''}
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'steps',
    title: 'Step by Step',
    description: 'Sequential steps with connecting line',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;gap:36px;padding:96px 80px 140px;color:${esc(p.text)}">
        <div style="font-size:54px;font-weight:800">${esc(d.headline)}</div>
        <div style="display:flex;flex-direction:column;gap:0">
          ${toArray(d.items).map((item, idx) => `
            <div style="display:flex;gap:28px">
              <div style="display:flex;flex-direction:column;align-items:center">
                <span style="width:52px;height:52px;border-radius:9999px;background:${esc(p.accent)};color:${esc(p.bg)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;flex-shrink:0">${idx + 1}</span>
                ${idx < toArray(d.items).length - 1 ? `<span style="width:3px;flex:1;background:${esc(p.accent)};opacity:0.35;min-height:36px"></span>` : ''}
              </div>
              <div style="font-size:30px;line-height:1.4;padding:10px 0 36px">${esc(item)}</div>
            </div>`).join('')}
        </div>
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'checklist',
    title: 'Checklist',
    description: 'Do / done list with checkmarks',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;gap:40px;padding:96px 80px 140px;color:${esc(p.text)}">
        <div style="font-size:56px;font-weight:800">${esc(d.headline)}</div>
        <div style="display:flex;flex-direction:column;gap:26px">
          ${toArray(d.items).map(item => `
            <div style="display:flex;gap:22px;align-items:center;font-size:31px">
              <span style="width:46px;height:46px;border-radius:12px;background:${esc(p.accent)};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${esc(p.bg)};font-weight:800;font-size:26px">&check;</span>
              <span>${esc(item)}</span>
            </div>`).join('')}
        </div>
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'comparison',
    title: 'Comparison',
    description: 'Two columns side by side',
    render: (d, p, i, t, bg) => {
      const half = Math.ceil(toArray(d.items).length / 2)
      const left = toArray(d.items).slice(0, half)
      const right = toArray(d.items).slice(half)
      const col = (items: string[], accent: boolean) => `
        <div style="flex:1;border-radius:24px;padding:36px;background:${accent ? esc(p.accent) : 'rgba(255,255,255,0.06)'};color:${accent ? esc(p.bg) : esc(p.text)};display:flex;flex-direction:column;gap:18px">
          ${items.map(item => `<div style="font-size:27px;line-height:1.35">${esc(item)}</div>`).join('')}
        </div>`
      return `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;gap:40px;padding:96px 72px 140px;color:${esc(p.text)}">
        <div style="font-size:52px;font-weight:800;text-align:center">${esc(d.headline)}</div>
        <div style="display:flex;gap:28px;flex:1">${col(left, true)}${col(right, false)}</div>
      </div>
      ${pageFooter(p, i, t, d.footer)}`
    },
  },
  {
    key: 'photo-left',
    title: 'Photo Left',
    description: 'Image panel left, text right',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;color:${esc(p.text)}">
        <div data-image-slot="bg" style="width:46%;position:relative;overflow:hidden;cursor:pointer">
          ${bg?.url
            ? `<img data-image="bg" src="${esc(bg.url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:drop-shadow(${bg.shadow.x}px ${bg.shadow.y}px ${bg.shadow.blur}px rgba(0,0,0,${bg.shadow.opacity}))" draggable="false">
               <div style="position:absolute;inset:0;background:rgba(0,0,0,${bg.dim})"></div>`
            : `<div data-image-empty="bg" style="position:absolute;inset:0;background:${esc(p.accent)};opacity:0.85;display:flex;align-items:center;justify-content:center;color:${esc(p.bg)};font-size:24px;font-weight:700">+ Add image</div>`}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:32px;padding:80px 72px 140px">
          ${accentBar(p)}
          <div style="font-size:64px;font-weight:800;line-height:1.1">${esc(d.headline)}</div>
          ${d.body ? `<div style="font-size:30px;line-height:1.5;opacity:0.8">${esc(d.body)}</div>` : ''}
        </div>
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'full-photo',
    title: 'Full Photo',
    description: 'Full-bleed image with overlay text',
    render: (d, p, i, t, bg) => `
      <div data-image-slot="bg" style="position:absolute;inset:0;background:${esc(p.bg)};overflow:hidden;cursor:pointer">
        ${bg?.url
          ? `<img data-image="bg" src="${esc(bg.url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:drop-shadow(${bg.shadow.x}px ${bg.shadow.y}px ${bg.shadow.blur}px rgba(0,0,0,${bg.shadow.opacity}))" draggable="false">
             <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.05) 100%)"></div>`
          : `<div data-image-empty="bg" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:${esc(p.text)};font-size:28px;font-weight:700;opacity:0.5">+ Add image</div>`}
      </div>
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:26px;padding:96px 80px 140px;color:#ffffff">
        ${d.kicker ? `<div style="font-size:24px;letter-spacing:0.26em;text-transform:uppercase;color:${esc(p.accent)};font-weight:700">${esc(d.kicker)}</div>` : ''}
        <div style="font-size:84px;font-weight:800;line-height:1.05;letter-spacing:-0.02em">${esc(d.headline)}</div>
        ${d.body ? `<div style="font-size:32px;line-height:1.45;opacity:0.9">${esc(d.body)}</div>` : ''}
      </div>
      ${pageFooter({ ...p, text: '#ffffff' }, i, t, d.footer)}`,
  },
  {
    key: 'qa',
    title: 'Q&A',
    description: 'Question big, answer below',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;gap:44px;padding:96px 84px 140px;color:${esc(p.text)}">
        <div style="display:flex;gap:24px;align-items:flex-start">
          <span style="font-size:26px;font-weight:800;letter-spacing:0.2em;color:${esc(p.accent)};flex-shrink:0;padding-top:10px">Q</span>
          <div style="font-size:56px;font-weight:800;line-height:1.15">${esc(d.headline)}</div>
        </div>
        <div style="display:flex;gap:24px;align-items:flex-start">
          <span style="font-size:26px;font-weight:800;letter-spacing:0.2em;color:${esc(p.accent)};flex-shrink:0;padding-top:12px">A</span>
          <div style="font-size:34px;line-height:1.5;opacity:0.85">${esc(d.body ?? '')}</div>
        </div>
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'myth-fact',
    title: 'Myth vs Fact',
    description: 'Debunk format with two blocks',
    render: (d, p, i, t, bg) => {
      const [myth = '', fact = ''] = toArray(d.items)
      return `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;gap:36px;padding:96px 80px 140px;color:${esc(p.text)}">
        <div style="border-radius:24px;border:3px solid rgba(239,68,68,0.6);padding:40px">
          <div style="font-size:24px;letter-spacing:0.24em;text-transform:uppercase;color:#ef4444;font-weight:800;margin-bottom:18px">Myth</div>
          <div style="font-size:36px;line-height:1.35">${esc(myth)}</div>
        </div>
        <div style="border-radius:24px;border:3px solid ${esc(p.accent)};padding:40px;background:${esc(p.accent)}22">
          <div style="font-size:24px;letter-spacing:0.24em;text-transform:uppercase;color:${esc(p.accent)};font-weight:800;margin-bottom:18px">Fact</div>
          <div style="font-size:36px;line-height:1.35">${esc(fact)}</div>
        </div>
      </div>
      ${pageFooter(p, i, t, d.footer)}`
    },
  },
  {
    key: 'cta',
    title: 'CTA Finale',
    description: 'Call to action closing slide',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:44px;padding:96px 84px 140px;color:${esc(p.text)}">
        ${accentBar(p)}
        <div style="font-size:88px;font-weight:800;line-height:1.08;letter-spacing:-0.02em">${esc(d.headline)}</div>
        ${d.body ? `<div style="font-size:32px;line-height:1.5;opacity:0.8;max-width:720px">${esc(d.body)}</div>` : ''}
        ${d.cta ? `<div style="margin-top:12px;padding:26px 64px;border-radius:9999px;background:${esc(p.accent)};color:${esc(p.bg)};font-size:34px;font-weight:800">${esc(d.cta)}</div>` : ''}
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'photo-grid',
    title: 'Photo Grid',
    description: 'Up to four photos tiled above a caption — add images in the Media panel',
    render: (d, p, i, t, bg) => {
      const imgs = toImagesArray(d.images).slice(0, 4)
      const cell = (idx: number): string => {
        const url = imgs[idx]
        return `<div data-image-slot="grid-${idx}" style="position:relative;flex:1;border-radius:20px;overflow:hidden;background:${esc(p.accent)}22;cursor:pointer">
          ${url
            ? `<img data-image="grid-${idx}" src="${esc(url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" draggable="false">`
            : `<div data-image-empty="grid-${idx}" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;font-size:22px;font-weight:700;color:${esc(p.accent)};opacity:0.6"><span style="font-size:32px">+</span>Add</div>`}
        </div>`
      }
      return `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;gap:36px;padding:88px 80px 140px;color:${esc(p.text)}">
        <div style="display:flex;flex-direction:column;gap:14px">
          ${d.kicker ? `<div style="font-size:24px;letter-spacing:0.24em;text-transform:uppercase;color:${esc(p.accent)};font-weight:700">${esc(d.kicker)}</div>` : ''}
          <div style="font-size:56px;font-weight:800;line-height:1.08">${esc(d.headline)}</div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:16px;min-height:0">
          <div style="flex:1;display:flex;gap:16px;min-height:0">${cell(0)}${cell(1)}</div>
          <div style="flex:1;display:flex;gap:16px;min-height:0">${cell(2)}${cell(3)}</div>
        </div>
      </div>
      ${pageFooter(p, i, t, d.footer)}`
    },
  },
  {
    key: 'polaroid',
    title: 'Polaroid',
    description: 'Tilted framed photo card with a caption strip',
    render: (d, p, i, t, bg) => {
      const url = toImagesArray(d.images)[0] ?? bg?.url
      return `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;padding:96px 90px 140px;color:${esc(p.text)}">
        <div style="width:70%;background:#ffffff;padding:26px 26px 18px;border-radius:12px;box-shadow:0 30px 60px rgba(0,0,0,0.35);transform:rotate(-2deg)">
          <div data-image-slot="polaroid" style="position:relative;width:100%;aspect-ratio:4/5;overflow:hidden;border-radius:6px;background:${esc(p.bg)};cursor:pointer">
            ${url ? `<img data-image="polaroid" src="${esc(url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" draggable="false">` : `<div data-image-empty="polaroid" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:18px;opacity:0.4">+ Add photo</div>`}
          </div>
          <div style="padding-top:16px;text-align:center;font-size:32px;line-height:1.3;color:#1c1917">${esc(d.headline)}</div>
        </div>
        ${d.body ? `<div style="font-size:30px;line-height:1.5;opacity:0.8;text-align:center;max-width:720px">${esc(d.body)}</div>` : ''}
      </div>
      ${pageFooter(p, i, t, d.footer)}`
    },
  },
  {
    key: 'stat-cards',
    title: 'Stat Cards',
    description: 'Items as numbered cards side by side',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;gap:44px;padding:96px 80px 140px;color:${esc(p.text)}">
        <div style="font-size:54px;font-weight:800;line-height:1.1">${esc(d.headline)}</div>
        <div style="display:flex;gap:22px;flex:1">
          ${toArray(d.items).map((item, idx) => `
            <div style="flex:1;border-radius:24px;padding:34px 26px;background:${idx % 2 === 0 ? esc(p.accent) : 'rgba(255,255,255,0.07)'};color:${idx % 2 === 0 ? esc(p.bg) : esc(p.text)};display:flex;flex-direction:column;gap:14px">
              <div style="font-size:80px;font-weight:800;line-height:1">${String(idx + 1).padStart(2, '0')}</div>
              <div style="font-size:25px;line-height:1.35">${esc(item)}</div>
            </div>`).join('')}
        </div>
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'split-band',
    title: 'Split Band',
    description: 'Angled accent band with bold headline over it',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:absolute;top:-160px;left:-80px;width:130%;height:54%;background:${esc(p.accent)};transform:rotate(-6deg);transform-origin:50% 50%"></div>
      <div style="position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;gap:34px;padding:96px 84px 140px;color:${esc(p.bg)}">
        ${d.kicker ? `<div style="font-size:24px;letter-spacing:0.26em;text-transform:uppercase;font-weight:700;opacity:0.75">${esc(d.kicker)}</div>` : ''}
        <div style="font-size:92px;font-weight:800;line-height:1.05;letter-spacing:-0.02em">${esc(d.headline)}</div>
        ${d.body ? `<div style="font-size:38px;line-height:1.45;color:${esc(p.text)};max-width:760px">${esc(d.body)}</div>` : ''}
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  // ── Five new high-performance layouts (based on 2025 IG carousel data) ──
  {
    key: 'number-hero',
    title: 'Number Hero',
    description: 'Gigantic number + headline — listicle slides that stop the scroll (3.1× saves)',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;padding:88px 80px 140px;color:${esc(p.text)}">
        <div style="display:flex;align-items:baseline;gap:18px">
          <span style="font-size:168px;line-height:0.85;font-weight:900;letter-spacing:-0.06em;color:${esc(p.accent)}">${String(i + 1).padStart(2, '0')}</span>
          <span style="width:72px;height:8px;background:${esc(p.accent)};border-radius:9999px;flex-shrink:0;margin-bottom:42px"></span>
        </div>
        <div style="margin-top:26px;font-size:64px;font-weight:800;line-height:1.08;letter-spacing:-0.02em">${esc(d.headline)}</div>
        ${d.body ? `<div style="margin-top:20px;font-size:30px;line-height:1.5;opacity:0.78;max-width:820px">${esc(d.body)}</div>` : ''}
        ${toArray(d.items).length ? `<div style="margin-top:28px;display:flex;flex-direction:column;gap:14px">${toArray(d.items).slice(0, 3).map(item => `<div style="display:flex;gap:14px;align-items:center;font-size:27px"><span style="width:10px;height:10px;border-radius:9999px;background:${esc(p.accent)};flex-shrink:0"></span><span>${esc(item)}</span></div>`).join('')}</div>` : ''}
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'feature-highlight',
    title: 'Feature Cards',
    description: 'Three feature cards with top accent — perfect for value stacks and tool lists',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;gap:32px;padding:88px 72px 140px;color:${esc(p.text)}">
        <div style="display:flex;flex-direction:column;gap:12px">
          ${d.kicker ? `<div style="font-size:22px;letter-spacing:0.22em;text-transform:uppercase;color:${esc(p.accent)};font-weight:700">${esc(d.kicker)}</div>` : ''}
          <div style="font-size:54px;font-weight:800;line-height:1.08">${esc(d.headline)}</div>
          ${d.body ? `<div style="font-size:26px;line-height:1.45;opacity:0.75">${esc(d.body)}</div>` : ''}
        </div>
        <div style="flex:1;display:flex;gap:18px;min-height:0">
          ${toArray(d.items).slice(0, 3).map(item => `
            <div style="flex:1;display:flex;flex-direction:column;gap:16px;padding:28px 22px;border-radius:20px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08)">
              <div style="width:48px;height:48px;border-radius:14px;background:${esc(p.accent)};display:flex;align-items:center;justify-content:center;font-weight:800;color:${esc(p.bg)};font-size:22px">${esc(item.slice(0, 1).toUpperCase())}</div>
              <div style="font-size:24px;line-height:1.35;font-weight:600">${esc(item)}</div>
            </div>`).join('')}
        </div>
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'testimonial',
    title: 'Testimonial',
    description: 'Social proof with avatar, quote and handle — 2.4× higher comment rate',
    render: (d, p, i, t, bg) => {
      const url = toImagesArray(d.images)[0] ?? bg?.url
      return `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;padding:96px 80px 140px;color:${esc(p.text)};text-align:center">
        <div data-image-slot="testimonial" style="position:relative;width:120px;height:120px;border-radius:9999px;overflow:hidden;border:4px solid ${esc(p.accent)};background:${esc(p.accent)}22;flex-shrink:0;cursor:pointer">
          ${url ? `<img data-image="testimonial" src="${esc(url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" draggable="false">` : `<div data-image-empty="testimonial" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:54px;opacity:0.5">☺</div>`}
        </div>
        <div style="font-size:48px;line-height:1.3;font-weight:700;max-width:860px">&ldquo;${esc(d.quote ?? d.headline)}&rdquo;</div>
        ${d.author ? `<div style="font-size:22px;letter-spacing:0.16em;text-transform:uppercase;opacity:0.7">— ${esc(d.author)}</div>` : ''}
        ${d.body ? `<div style="margin-top:8px;padding:14px 22px;border-radius:9999px;background:${esc(p.accent)};color:${esc(p.bg)};font-size:22px;font-weight:700">${esc(d.body)}</div>` : ''}
      </div>
      ${pageFooter(p, i, t, d.footer)}`
    },
  },
  {
    key: 'timeline',
    title: 'Timeline',
    description: 'Vertical timeline — ideal for processes and story arcs with high completion',
    render: (d, p, i, t, bg) => `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;gap:30px;padding:88px 84px 140px;color:${esc(p.text)}">
        <div style="font-size:52px;font-weight:800;line-height:1.1">${esc(d.headline)}</div>
        <div style="flex:1;display:flex;flex-direction:column;gap:0;justify-content:center">
          ${toArray(d.items).slice(0, 5).map((item, idx, arr) => `
            <div style="display:flex;gap:24px;align-items:flex-start;min-height:92px">
              <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
                <span style="width:44px;height:44px;border-radius:9999px;background:${idx === 0 ? esc(p.accent) : 'rgba(255,255,255,0.12)'};color:${idx === 0 ? esc(p.bg) : esc(p.text)};border:2px solid ${esc(p.accent)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px">${idx + 1}</span>
                ${idx < arr.length - 1 ? `<span style="width:2px;flex:1;min-height:28px;background:${esc(p.accent)};opacity:0.35;margin:6px 0"></span>` : ''}
              </div>
              <div style="flex:1;padding-top:8px">
                <div style="font-size:26px;line-height:1.4;font-weight:600">${esc(item)}</div>
                ${idx === 0 && d.body ? `<div style="font-size:22px;opacity:0.65;margin-top:6px">${esc(d.body)}</div>` : ''}
              </div>
            </div>`).join('')}
        </div>
      </div>
      ${pageFooter(p, i, t, d.footer)}`,
  },
  {
    key: 'image-focus',
    title: 'Image Focus',
    description: 'Large image with caption bar — photo carousels get 2× saves for travel/food',
    render: (d, p, i, t, bg) => {
      const url = toImagesArray(d.images)[0] ?? bg?.url
      return `
      ${bgLayer(p, bg)}
      ${patternLayer('__PATTERN__')}
      <div style="position:relative;height:100%;display:flex;flex-direction:column;padding:0;color:${esc(p.text)}">
        <div data-image-slot="focus" style="flex:1;position:relative;overflow:hidden;background:${esc(p.accent)}14;margin:36px 48px 0;border-radius:20px;border:1px solid rgba(255,255,255,0.08);cursor:pointer">
          ${url ? `<img data-image="focus" src="${esc(url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" draggable="false"><div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 45%);pointer-events:none"></div>` : `<div data-image-empty="focus" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:28px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.35;color:${esc(p.accent)}">+ Add image</div>`}
          ${d.kicker ? `<div style="position:absolute;top:18px;left:18px;padding:8px 14px;border-radius:9999px;background:${esc(p.accent)};color:${esc(p.bg)};font-size:16px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">${esc(d.kicker)}</div>` : ''}
        </div>
        <div style="padding:28px 56px 44px;display:flex;flex-direction:column;gap:14px">
          <div style="font-size:54px;font-weight:800;line-height:1.08">${esc(d.headline)}</div>
          ${d.body ? `<div style="font-size:26px;line-height:1.5;opacity:0.78">${esc(d.body)}</div>` : ''}
        </div>
      </div>
      ${pageFooter(p, i, t, d.footer)}`
    },
  },
]

export function renderSlideHtml(
  templateKey: string,
  data: SlideData,
  palette: SlidePalette,
  index: number,
  total: number,
  patternHtml: string,
  bgImage?: BgImageLayer,
  flow?: DeckFlow,
  handle?: string,
): string {
  const template = CAROUSEL_TEMPLATES.find(tpl => tpl.key === templateKey) ?? CAROUSEL_TEMPLATES[0]!
  const effectiveData: SlideData = handle ? { ...data, footer: handle } : data
  let html = template.render(effectiveData, palette, index, total, bgImage)
  const fontStack = fontFamilyStack(palette.font)
  const fontCss = fontStack ? `font-family:${fontStack};` : ''
  html = html.replaceAll(
    'position:relative;height:100%',
    `position:relative;height:100%;transform:var(--slide-fx,none);transform-origin:50% 50%;${fontCss}`,
  )
  if (flow && flow.mode !== 'off') {
    const baseBg = bgLayer(palette, bgImage)
    const flowHtml = flowLayer(flow, index, total)
    if (flowHtml) html = html.replace(baseBg, () => flowHtml)
  }
  const borderRadius = data.borderRadius ?? 0
  if (borderRadius > 0) {
    html = `<div style="position:absolute;inset:0;border-radius:${borderRadius}px;overflow:hidden">${html}</div>`
  }
  return html.replace('__PATTERN__', patternHtml)
}
