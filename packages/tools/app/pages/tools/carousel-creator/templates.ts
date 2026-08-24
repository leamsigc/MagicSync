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
}

export interface SlidePalette {
  bg: string
  text: string
  accent: string
  patternColor: string
}

export interface BgImageLayer {
  url: string
  dim: number
  shadow: { x: number, y: number, blur: number, opacity: number }
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

function bgLayer(palette: SlidePalette, bgImage?: BgImageLayer): string {
  if (!bgImage?.url) {
    return `<div style="position:absolute;inset:0;background:${esc(palette.bg)}"></div>`
  }
  const s = bgImage.shadow
  const shadow = `drop-shadow(${s.x}px ${s.y}px ${s.blur}px rgba(0,0,0,${s.opacity}))`
  return `<div style="position:absolute;inset:0;background:${esc(palette.bg)}">
    <img src="${esc(bgImage.url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:${shadow}" draggable="false">
    <div style="position:absolute;inset:0;background:rgba(0,0,0,${bgImage.dim})"></div>
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
  return `<div style="position:absolute;left:64px;right:64px;bottom:44px;display:flex;justify-content:space-between;align-items:center;font-size:22px;letter-spacing:0.12em;text-transform:uppercase;color:${esc(palette.text)};opacity:0.55">
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
          ${(d.items ?? []).map((item, idx) => `
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
          ${(d.items ?? []).map((item, idx) => `
            <div style="display:flex;gap:28px">
              <div style="display:flex;flex-direction:column;align-items:center">
                <span style="width:52px;height:52px;border-radius:9999px;background:${esc(p.accent)};color:${esc(p.bg)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;flex-shrink:0">${idx + 1}</span>
                ${idx < (d.items?.length ?? 0) - 1 ? `<span style="width:3px;flex:1;background:${esc(p.accent)};opacity:0.35;min-height:36px"></span>` : ''}
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
          ${(d.items ?? []).map(item => `
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
      const half = Math.ceil((d.items?.length ?? 0) / 2)
      const left = (d.items ?? []).slice(0, half)
      const right = (d.items ?? []).slice(half)
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
        <div style="width:46%;position:relative">
          ${bg?.url
            ? `<img src="${esc(bg.url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:drop-shadow(${bg.shadow.x}px ${bg.shadow.y}px ${bg.shadow.blur}px rgba(0,0,0,${bg.shadow.opacity}))" draggable="false">
               <div style="position:absolute;inset:0;background:rgba(0,0,0,${bg.dim})"></div>`
            : `<div style="position:absolute;inset:0;background:${esc(p.accent)};opacity:0.85"></div>`}
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
      <div style="position:absolute;inset:0;background:${esc(p.bg)}">
        ${bg?.url
          ? `<img src="${esc(bg.url)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:drop-shadow(${bg.shadow.x}px ${bg.shadow.y}px ${bg.shadow.blur}px rgba(0,0,0,${bg.shadow.opacity}))" draggable="false">
             <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.05) 100%)"></div>`
          : `<div style="position:absolute;inset:0;background:${esc(p.bg)}"></div>`}
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
      const [myth = '', fact = ''] = d.items ?? []
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
  html = html.replaceAll(
    'position:relative;height:100%',
    'position:relative;height:100%;transform:var(--slide-fx,none);transform-origin:50% 50%',
  )
  if (flow && flow.mode !== 'off') {
    const baseBg = bgLayer(palette, bgImage)
    const flowHtml = flowLayer(flow, index, total)
    if (flowHtml) html = html.replace(baseBg, () => flowHtml)
  }
  return html.replace('__PATTERN__', patternHtml)
}
