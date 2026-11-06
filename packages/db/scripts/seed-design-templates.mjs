/**
 * Seed the free design-template catalog (`type = 'IMAGES'`, public).
 *
 * Run: node packages/tools/scripts/seed-design-templates.mjs
 * Idempotent: fixed ids + INSERT OR IGNORE, so reruns never duplicate.
 * Requires at least one user (designs are owned rows). Uses the same
 * envelope shape the studio stores: {schema:'magicsync/image-editor@1', doc,
 * meta, savedAt} inside `templates.content`.
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'

const url = process.env.NUXT_TURSO_DATABASE_URL || 'file:local.db'
const db = createClient({ url, authToken: process.env.NUXT_TURSO_AUTH_TOKEN })

const SCHEMA = 'magicsync/image-editor@1'

/** Small fabric-v7 textbox with an id so {variables} can bind to it. */
function textbox(id, text, options = {}) {
  return {
    id,
    name: text,
    type: 'textbox',
    originX: 'left',
    originY: 'top',
    version: '7.0.0',
    left: options.left ?? 80,
    top: options.top ?? 80,
    width: options.width ?? 880,
    text,
    fontSize: options.fontSize ?? 64,
    fontFamily: options.fontFamily ?? 'Archivo Black',
    fontWeight: options.fontWeight ?? 'bold',
    fill: options.fill ?? '#111827',
    textAlign: options.textAlign ?? 'left',
    lineHeight: 1.1,
  }
}

function rect(id, width, height, fill, options = {}) {
  return {
    id,
    type: 'rect',
    version: '7.0.0',
    originX: 'left',
    originY: 'top',
    left: options.left ?? 0,
    top: options.top ?? 0,
    width,
    height,
    fill,
    rx: options.rx ?? 0,
    ry: options.ry ?? 0,
  }
}


/** Escape text for SVG markup. */
function esc(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

/** Fetch an image once and return an inline data URL (SVG-as-<img> blocks remote refs). */
const thumbnailImageCache = new Map()

function isInlinableImage(src) {
  if (typeof src !== 'string' || src.length === 0) return false
  return src.startsWith('data:image/') || /^https?:\/\//.test(src)
}

async function fetchThumbnailDataUrl(src) {
  try {
    const response = await fetch(src, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) return null
    const type = String(response.headers.get('content-type') ?? '').split(';')[0]
    if (!type.startsWith('image/')) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length === 0 || buffer.length > 900_000) return null
    return `data:${type};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

async function inlineThumbnailImage(src) {
  if (!isInlinableImage(src)) return null
  if (src.startsWith('data:image/')) return src
  if (thumbnailImageCache.has(src)) return thumbnailImageCache.get(src)
  const job = fetchThumbnailDataUrl(src)
  thumbnailImageCache.set(src, job)
  return job
}

async function thumbImage(obj, scale) {
  const x = Math.round((obj.left ?? 0) * scale)
  const y = Math.round((obj.top ?? 0) * scale)
  const width = Math.round((obj.width ?? 0) * scale)
  const height = Math.round((obj.height ?? 0) * scale)
  const href = await inlineThumbnailImage(obj.src)
  if (!href) return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#94a3b8" opacity="0.85" rx="6"/>`
  return `<image x="${x}" y="${y}" width="${width}" height="${height}" href="${href}" preserveAspectRatio="none"/>`
}

function thumbRect(obj, scale) {
  const x = Math.round((obj.left ?? 0) * scale)
  const y = Math.round((obj.top ?? 0) * scale)
  const width = Math.round((obj.width ?? 0) * scale)
  const height = Math.round((obj.height ?? 0) * scale)
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${esc(obj.fill ?? '#111827')}" rx="${Math.round((obj.rx ?? 0) * scale)}"/>`
}

function thumbCircle(obj, scale) {
  const x = Math.round((obj.left ?? 0) * scale)
  const y = Math.round((obj.top ?? 0) * scale)
  return `<circle cx="${x}" cy="${y}" r="${Math.round((obj.radius ?? 40) * scale)}" fill="${esc(obj.fill ?? '#111827')}"/>`
}

function thumbText(obj, scale) {
  const x = Math.round((obj.left ?? 0) * scale)
  const y = Math.round((obj.top ?? 0) * scale)
  const size = Math.max(8, Math.round((obj.fontSize ?? 40) * scale))
  const centered = obj.textAlign === 'center'
  const anchor = centered ? 'middle' : 'start'
  const textX = centered ? x + Math.round((obj.width ?? 0) * scale / 2) : x
  return obj.text.split('\n').map((line, index) =>
    `<text x="${textX}" y="${Math.round(y + size * (index + 1))}" font-family="system-ui, sans-serif" font-size="${size}" font-weight="${obj.fontWeight ?? 600}" text-anchor="${anchor}" fill="${esc(obj.fill ?? '#111827')}">${esc(line)}</text>`,
  ).join('')
}

function isTextObject(obj) {
  return typeof obj.text === 'string' && obj.text.length > 0
}

async function thumbObject(obj, scale) {
  if (obj.type === 'image') return thumbImage(obj, scale)
  if (obj.type === 'rect' || obj.type === 'triangle') return thumbRect(obj, scale)
  if (obj.type === 'circle') return thumbCircle(obj, scale)
  if (isTextObject(obj)) return thumbText(obj, scale)
  return ''
}

/** Cheap SVG preview (background + blocks + text) used as the template thumbnail. */
async function thumbSvg(template) {
  const frame = template.frame ?? template.document?.frame ?? { width: 1080, height: 1080, fill: '#ffffff' }
  const objects = template.objects ?? template.document?.pages?.[0]?.objects ?? []
  const scale = 480 / frame.width
  const height = Math.round(frame.height * scale)
  const hasBackgroundImage = objects.some((obj) => obj.id === '__background')
  const parts = [
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f766e"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>`,
    `<rect width="100%" height="100%" fill="${hasBackgroundImage ? 'url(#bg)' : esc(frame.fill)}"/>`,
  ]
  for (const obj of objects) {
    const part = await thumbObject(obj, scale)
    if (part) parts.push(part)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="${height}" viewBox="0 0 480 ${height}">${parts.join('')}</svg>`
}

/** A full-frame `bg` rect duplicates the page fill; fold it into the frame. */
function foldPageFill(doc) {
  const page = doc.pages?.[0]
  const objects = page?.objects ?? []
  const frame = doc.frame ?? { width: 1080, height: 1080, fill: '#ffffff' }
  const fillRect = objects.find((obj) =>
    obj.id === 'bg'
    && obj.type === 'rect'
    && (obj.width ?? 0) >= frame.width * 0.95
    && (obj.height ?? 0) >= frame.height * 0.95)
  if (!fillRect) return doc
  const fill = typeof fillRect.fill === 'string' ? fillRect.fill : frame.fill
  return {
    ...doc,
    frame: { ...frame, fill },
    pages: doc.pages.map((entry, index) => index === 0
      ? { ...entry, objects: entry.objects.filter((obj) => obj !== fillRect), background: { ...entry.background, fill } }
      : entry),
  }
}

/** One page document from objects; fields bind each {name} textbox. */
function document(title, frame, objects, fields) {
  const page = {
    id: 'page-1',
    name: 'Page 1',
    duration: 4000,
    objects,
    background: { fill: frame.fill },
    animation: { layers: {} },
  }
  return {
    schema: SCHEMA,
    version: 1,
    frame: { width: frame.width, height: frame.height, fill: frame.fill },
    fields: fields.map(([name, objectId, property]) => ({ name, targets: [{ objectId, property }] })),
    meta: { title, tags: ['free', 'studio'], category: 'social' },
    pages: [page],
  }
}

const TEMPLATES = [
  {
    id: 'seed-design-sale',
    title: 'Flash Sale Announcement',
    frame: { width: 1080, height: 1080, fill: '#fdf6ec' },
    objects: [
      rect('bg', 1080, 1080, '#fdf6ec'),
      rect('band', 1080, 300, '#c2410c', { top: 780 }),
      textbox('t-headline', '{headline}', { left: 80, top: 160, width: 920, fontSize: 108, fill: '#111827' }),
      textbox('t-subhead', '{subhead}', { left: 80, top: 420, width: 920, fontSize: 48, fontWeight: 'normal', fill: '#374151' }),
      textbox('t-discount', '{discount}', { left: 80, top: 820, width: 920, fontSize: 96, fill: '#ffffff', textAlign: 'center' }),
      textbox('t-cta', '{cta}', { left: 80, top: 960, width: 920, fontSize: 36, fontFamily: 'DejaVu Sans', fontWeight: 'normal', fill: '#fdba74', textAlign: 'center' }),
    ],
    fields: [
      ['headline', 't-headline', 'text'],
      ['subhead', 't-subhead', 'text'],
      ['discount', 't-discount', 'text'],
      ['cta', 't-cta', 'text'],
    ],
  },
  {
    id: 'seed-design-story',
    title: 'Vertical Story Promo',
    frame: { width: 1080, height: 1920, fill: '#0f172a' },
    objects: [
      rect('bg', 1080, 1920, '#0f172a'),
      rect('accent', 220, 220, '#22c55e', { left: 760, top: 180, rx: 110, ry: 110 }),
      textbox('t-title', '{title}', { left: 90, top: 620, width: 900, fontSize: 128, fill: '#f8fafc' }),
      textbox('t-body', '{body}', { left: 90, top: 1180, width: 900, fontSize: 52, fontFamily: 'DejaVu Sans', fontWeight: 'normal', fill: '#cbd5e1' }),
      textbox('t-cta', '{cta}', { left: 90, top: 1640, width: 900, fontSize: 44, fontFamily: 'DejaVu Sans', fill: '#22c55e' }),
    ],
    fields: [
      ['title', 't-title', 'text'],
      ['body', 't-body', 'text'],
      ['cta', 't-cta', 'text'],
    ],
  },
  {
    id: 'seed-design-quote',
    title: 'Quote Card',
    frame: { width: 1080, height: 1080, fill: '#111827' },
    objects: [
      rect('bg', 1080, 1080, '#111827'),
      textbox('t-quote', '{quote}', { left: 100, top: 280, width: 880, fontSize: 76, fontFamily: 'DejaVu Sans', fontWeight: 'normal', fill: '#f9fafb' }),
      textbox('t-author', '{author}', { left: 100, top: 800, width: 880, fontSize: 40, fontFamily: 'DejaVu Sans', fill: '#9ca3af' }),
    ],
    fields: [
      ['quote', 't-quote', 'text'],
      ['author', 't-author', 'text'],
    ],
  },
  {
    id: 'seed-design-event',
    title: 'Event Poster',
    frame: { width: 1242, height: 1660, fill: '#f5f3ff' },
    objects: [
      rect('bg', 1242, 1660, '#f5f3ff'),
      rect('header', 1242, 420, '#7c3aed'),
      textbox('t-event', '{event}', { left: 80, top: 120, width: 1082, fontSize: 104, fill: '#ffffff' }),
      textbox('t-date', '{date}', { left: 80, top: 560, width: 1082, fontSize: 56, fontFamily: 'DejaVu Sans', fill: '#4c1d95' }),
      textbox('t-place', '{place}', { left: 80, top: 680, width: 1082, fontSize: 44, fontFamily: 'DejaVu Sans', fontWeight: 'normal', fill: '#6d28d9' }),
      textbox('t-details', '{details}', { left: 80, top: 900, width: 1082, fontSize: 38, fontFamily: 'DejaVu Sans', fontWeight: 'normal', fill: '#4b5563' }),
    ],
    fields: [
      ['event', 't-event', 'text'],
      ['date', 't-date', 'text'],
      ['place', 't-place', 'text'],
      ['details', 't-details', 'text'],
    ],
  },
  {
    id: 'seed-design-product',
    title: 'Product Feature',
    frame: { width: 1200, height: 1200, fill: '#ecfeff' },
    objects: [
      rect('bg', 1200, 1200, '#ecfeff'),
      rect('card', 1040, 700, '#ffffff', { left: 80, top: 380, rx: 32, ry: 32 }),
      textbox('t-product', '{product}', { left: 140, top: 460, width: 920, fontSize: 84, fill: '#0e7490' }),
      textbox('t-price', '{price}', { left: 140, top: 620, width: 920, fontSize: 64, fontFamily: 'DejaVu Sans', fill: '#111827' }),
      textbox('t-benefit', '{benefit}', { left: 140, top: 760, width: 920, fontSize: 40, fontFamily: 'DejaVu Sans', fontWeight: 'normal', fill: '#475569' }),
      textbox('t-cta', '{cta}', { left: 140, top: 920, width: 920, fontSize: 38, fontFamily: 'DejaVu Sans', fill: '#0e7490' }),
    ],
    fields: [
      ['product', 't-product', 'text'],
      ['price', 't-price', 'text'],
      ['benefit', 't-benefit', 'text'],
      ['cta', 't-cta', 'text'],
    ],
  },
  {
    id: 'seed-design-podcast',
    title: 'Podcast Episode Cover',
    frame: { width: 1080, height: 1080, fill: '#0b1120' },
    objects: [
      rect('bg', 1080, 1080, '#0b1120'),
      rect('accent', 1080, 200, '#8b5cf6', { top: 880 }),
      textbox('t-show', '{show}', { left: 80, top: 120, width: 920, fontSize: 42, fontFamily: 'DejaVu Sans', fill: '#a78bfa' }),
      textbox('t-episode', '{episode}', { left: 80, top: 300, width: 920, fontSize: 96, fill: '#f8fafc' }),
      textbox('t-guest', '{guest}', { left: 80, top: 640, width: 920, fontSize: 52, fontFamily: 'DejaVu Sans', fontWeight: 'normal', fill: '#cbd5e1' }),
      textbox('t-cta', '{cta}', { left: 80, top: 930, width: 920, fontSize: 38, fontFamily: 'DejaVu Sans', fill: '#ede9fe' }),
    ],
    fields: [
      ['show', 't-show', 'text'],
      ['episode', 't-episode', 'text'],
      ['guest', 't-guest', 'text'],
      ['cta', 't-cta', 'text'],
    ],
  },
  {
    id: 'seed-design-listing',
    title: 'Real Estate Listing',
    frame: { width: 1080, height: 1350, fill: '#f0fdf4' },
    objects: [
      rect('bg', 1080, 1350, '#f0fdf4'),
      rect('photo', 920, 620, '#bbf7d0', { left: 80, top: 80, rx: 24, ry: 24 }),
      textbox('t-price', '{price}', { left: 80, top: 760, width: 920, fontSize: 84, fill: '#166534' }),
      textbox('t-address', '{address}', { left: 80, top: 900, width: 920, fontSize: 44, fontFamily: 'DejaVu Sans', fontWeight: 'normal', fill: '#14532d' }),
      textbox('t-details', '{details}', { left: 80, top: 1020, width: 920, fontSize: 34, fontFamily: 'DejaVu Sans', fontWeight: 'normal', fill: '#4b5563' }),
      textbox('t-agent', '{agent}', { left: 80, top: 1220, width: 920, fontSize: 32, fontFamily: 'DejaVu Sans', fill: '#166534' }),
    ],
    fields: [
      ['price', 't-price', 'text'],
      ['address', 't-address', 'text'],
      ['details', 't-details', 'text'],
      ['agent', 't-agent', 'text'],
    ],
  },
  {
    id: 'seed-design-restaurant',
    title: 'Restaurant Special',
    frame: { width: 1080, height: 1350, fill: '#1c1917' },
    objects: [
      rect('bg', 1080, 1350, '#1c1917'),
      rect('plate', 520, 520, '#f59e0b', { left: 280, top: 120, rx: 260, ry: 260 }),
      textbox('t-dish', '{dish}', { left: 80, top: 700, width: 920, fontSize: 80, fill: '#fef3c7' }),
      textbox('t-description', '{description}', { left: 80, top: 860, width: 920, fontSize: 38, fontFamily: 'DejaVu Sans', fontWeight: 'normal', fill: '#d6d3d1' }),
      textbox('t-price', '{price}', { left: 80, top: 1120, width: 920, fontSize: 54, fill: '#fbbf24' }),
    ],
    fields: [
      ['dish', 't-dish', 'text'],
      ['description', 't-description', 'text'],
      ['price', 't-price', 'text'],
    ],
  },
  {
    id: 'seed-design-course',
    title: 'Course Launch',
    frame: { width: 1080, height: 1080, fill: '#eff6ff' },
    objects: [
      rect('bg', 1080, 1080, '#eff6ff'),
      rect('stripe', 1080, 180, '#2563eb', { top: 900 }),
      textbox('t-kicker', '{kicker}', { left: 80, top: 120, width: 920, fontSize: 36, fontFamily: 'DejaVu Sans', fill: '#1d4ed8' }),
      textbox('t-course', '{course}', { left: 80, top: 220, width: 920, fontSize: 88, fill: '#0f172a' }),
      textbox('t-outcome', '{outcome}', { left: 80, top: 560, width: 920, fontSize: 40, fontFamily: 'DejaVu Sans', fontWeight: 'normal', fill: '#334155' }),
      textbox('t-cta', '{cta}', { left: 80, top: 950, width: 920, fontSize: 40, fontFamily: 'DejaVu Sans', fill: '#eff6ff' }),
    ],
    fields: [
      ['kicker', 't-kicker', 'text'],
      ['course', 't-course', 'text'],
      ['outcome', 't-outcome', 'text'],
      ['cta', 't-cta', 'text'],
    ],
  },
  {
    id: 'seed-design-hiring',
    title: 'We Are Hiring',
    frame: { width: 1080, height: 1350, fill: '#fffbeb' },
    objects: [
      rect('bg', 1080, 1350, '#fffbeb'),
      rect('side', 90, 1350, '#f59e0b'),
      textbox('t-role', '{role}', { left: 170, top: 260, width: 830, fontSize: 96, fill: '#111827' }),
      textbox('t-location', '{location}', { left: 170, top: 520, width: 830, fontSize: 44, fontFamily: 'DejaVu Sans', fill: '#b45309' }),
      textbox('t-details', '{details}', { left: 170, top: 700, width: 830, fontSize: 38, fontFamily: 'DejaVu Sans', fontWeight: 'normal', fill: '#4b5563' }),
      textbox('t-apply', '{apply}', { left: 170, top: 1140, width: 830, fontSize: 36, fontFamily: 'DejaVu Sans', fill: '#b45309' }),
    ],
    fields: [
      ['role', 't-role', 'text'],
      ['location', 't-location', 'text'],
      ['details', 't-details', 'text'],
      ['apply', 't-apply', 'text'],
    ],
  },
]

// Additional pre-converted templates. `seed-templates/` is versioned with the
// repo; `import-templates/` is git-ignored so an admin can drop private/public
// designs there and publish them with `pnpm design:seed`.
const scriptsDir = dirname(fileURLToPath(import.meta.url))
const templateDirs = [
  join(scriptsDir, 'seed-templates'),
  join(scriptsDir, 'import-templates'),
]
const extraFiles = (await Promise.all(templateDirs.map(dir => readdir(dir)
  .then(files => files.filter(file => file.endsWith('.json')).map(file => join(dir, file)))
  .catch(() => [])))).flat()
const extras = await Promise.all(extraFiles.map(async (file) => {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    return parsed?.document ? parsed : null
  } catch (error) {
    console.warn(`seed: skipped ${file} (${error.message})`)
    return null
  }
}))

const owner = await db.execute('select id from user limit 1')
const ownerId = owner.rows[0]?.id
if (!ownerId) {
  console.log('seed: no user rows — register a user first, then rerun.')
  process.exit(0)
}

const allTemplates = [...TEMPLATES, ...extras.filter(Boolean)]
let inserted = 0
for (const template of allTemplates) {
  const now = new Date()
  const doc = foldPageFill(template.document ?? document(template.title, template.frame, template.objects, template.fields))
  const content = JSON.stringify({
    schema: SCHEMA,
    doc,
    meta: { title: template.title, tags: ['free', 'studio'] },
    savedAt: now.toISOString(),
  })
  const result = await db.execute({
    sql: `insert or replace into templates (id, ownerId, type, title, content, isPublic, createdAt, updatedAt)
          values (?, ?, 'IMAGES', ?, ?, 1, ?, ?)`,
    args: [template.id, ownerId, template.title, content, Math.floor(now.getTime() / 1000), Math.floor(now.getTime() / 1000)],
  })
  inserted += result.rowsAffected
  // Thumbnail preview (SVG data URL) so the template picker never shows a blank card.
  const svg = await thumbSvg({ frame: doc.frame, objects: doc.pages?.[0]?.objects ?? [] })
  await db.execute({
    sql: `insert or replace into template_assets (id, templateId, name, url, createdAt)
          values (?, ?, 'thumb.svg', ?, ?)`,
    args: [
      `seed-thumb-${template.id}`,
      template.id,
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      Math.floor(now.getTime() / 1000),
    ],
  })
}

console.log(`seed: ${inserted} template(s) inserted, ${allTemplates.length - inserted} already present.`)
