/**
 * Convert a Polotno Studio JSON (schemaVersion 4) into an ImageEditorDocument.
 *
 * Run: node packages/tools/scripts/convert-polotno-template.mjs <input.json> <output.json> [id] [title]
 *
 * Polotno uses `{width,height,pages:[{children}]}` with top-left `x`/`y`,
 * `rotation`, `text`/`image`/`svg` nodes and a URL or color page background.
 * The output is our `magicsync/image-editor@1` document (fabric v7 objects).
 */
import { readFile, writeFile } from 'node:fs/promises'

const [inputPath, outputPath, id = 'seed-design-polotno', title = 'Converted template'] = process.argv.slice(2)
if (!inputPath || !outputPath) {
  console.error('usage: convert-polotno-template.mjs <input.json> <output.json> [id] [title]')
  process.exit(1)
}

const source = JSON.parse(await readFile(inputPath, 'utf8'))
const page = source.pages?.[0] ?? {}
const frame = {
  width: Math.round(Number(page.width) || Number(source.width) || 1080),
  height: Math.round(Number(page.height) || Number(source.height) || 1080),
  fill: typeof page.background === 'string' && !page.background.startsWith('http')
    ? page.background
    : '#ffffff',
}

/** Natural size of the page background image (Unsplash URLs carry w=1080). */
const BACKGROUND_NATURAL = { width: 1080, height: 608 }

function objectId(node) {
  return `p-${String(node.id ?? Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g, '')}`
}

function animationsOf(node, objectIdValue, layers) {
  const enter = (node.animations ?? []).find(entry => entry.type === 'enter' && entry.enabled !== false)
  if (!enter) return
  const map = { zoom: 'zoomIn', fade: 'fadeIn', slide: 'slideLeft', bounce: 'pop' }
  layers[objectIdValue] = {
    enter: {
      type: map[enter.name] ?? 'fadeIn',
      duration: Math.max(100, Number(enter.duration) || 500),
      delay: Math.max(0, Number(enter.delay) || 0),
      easing: 'easeOutCubic',
    },
  }
}

function convertNode(node, layers) {
  const id = objectId(node)
  const base = {
    id,
    left: Number(node.x ?? 0),
    top: Number(node.y ?? 0),
    angle: Number(node.rotation ?? 0),
    opacity: Number(node.opacity ?? 1),
    visible: node.visible !== false,
    originX: 'left',
    originY: 'top',
    selectable: true,
    evented: true,
  }

  if (node.type === 'text' && typeof node.text === 'string') {
    animationsOf(node, id, layers)
    return {
      ...base,
      type: 'textbox',
      name: node.name || undefined,
      width: Number(node.width ?? 400),
      text: node.text,
      fontSize: Number(node.fontSize ?? 48),
      fontFamily: String(node.fontFamily ?? 'DejaVu Sans'),
      fontWeight: node.fontWeight === 'bold' ? 'bold' : 'normal',
      fontStyle: node.fontStyle === 'italic' ? 'italic' : 'normal',
      textAlign: node.align ?? 'left',
      lineHeight: Number(node.lineHeight ?? 1.16),
      charSpacing: Number(node.letterSpacing ?? 0),
      fill: typeof node.fill === 'string' ? node.fill : '#111827',
      underline: node.textDecoration === 'underline',
      linethrough: node.textDecoration === 'line-through',
    }
  }

  if ((node.type === 'image' || node.type === 'svg') && typeof node.src === 'string') {
    animationsOf(node, id, layers)
    return {
      ...base,
      type: 'image',
      name: node.name || undefined,
      width: Number(node.width ?? 300),
      height: Number(node.height ?? 300),
      scaleX: 1,
      scaleY: 1,
      src: node.src,
      crossOrigin: 'anonymous',
      ...(node.grayscaleEnabled ? { filters: [{ type: 'Grayscale' }] } : {}),
    }
  }

  return null
}

const layers = {}
const objects = (page.children ?? [])
  .map(node => convertNode(node, layers))
  .filter(Boolean)

// Page background becomes a real __background layer so it exports and batches.
if (typeof page.background === 'string' && page.background.startsWith('http')) {
  const scale = Math.max(frame.width / BACKGROUND_NATURAL.width, frame.height / BACKGROUND_NATURAL.height)
  objects.unshift({
    id: '__background',
    name: 'Background',
    type: 'image',
    src: page.background,
    crossOrigin: 'anonymous',
    left: Math.round((frame.width - BACKGROUND_NATURAL.width * scale) / 2),
    top: Math.round((frame.height - BACKGROUND_NATURAL.height * scale) / 2),
    width: BACKGROUND_NATURAL.width,
    height: BACKGROUND_NATURAL.height,
    scaleX: scale,
    scaleY: scale,
    originX: 'left',
    originY: 'top',
    visible: true,
    selectable: false,
    evented: false,
  })
}

const document = {
  schema: 'magicsync/image-editor@1',
  version: 1,
  frame,
  fields: [],
  meta: { title, tags: ['free', 'studio', 'podcast'], category: 'social' },
  pages: [{
    id: 'page-1',
    name: 'Page 1',
    duration: Math.max(1000, Math.round(Number(page.duration) || 4000)),
    objects,
    background: { fill: frame.fill },
    animation: { layers },
  }],
}

await writeFile(outputPath, `${JSON.stringify({ id, title, document }, null, 2)}\n`)
console.log(`converted ${objects.length} object(s) → ${outputPath}`)
