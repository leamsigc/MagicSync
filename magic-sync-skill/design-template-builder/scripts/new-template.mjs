#!/usr/bin/env node
/**
 * Scaffold a valid MagicSync image-editor document.
 *
 * Usage:
 *   node scripts/new-template.mjs --size square --title "Spring sale" --out template.json
 *   node scripts/new-template.mjs --size 1080x1350 --blank
 *
 * Sizes: square (1080x1080), portrait (1080x1350), story (1080x1920),
 * landscape (1920x1080), link (1200x628), youtube (1280x720), WIDTHxHEIGHT.
 */
import { writeFile } from 'node:fs/promises'
import { DOCUMENT_SCHEMA, ensureParent, parseArgs, parseSize } from './_shared.mjs'

const args = parseArgs(process.argv.slice(2))
const [width, height] = parseSize(args.size ?? 'square')
const title = String(args.title ?? 'Untitled design')
const fill = String(args.fill ?? '#0f172a')
const textFill = String(args.text ?? '#ffffff')
const mutedFill = String(args.muted ?? '#cbd5e1')
const margin = Math.round(Math.min(width, height) * 0.07)
const headlineSize = Math.round(Math.min(width, height) * 0.085)
const bodySize = Math.max(22, Math.round(headlineSize * 0.42))

const document = {
  schema: DOCUMENT_SCHEMA,
  version: 1,
  frame: { width, height, fill },
  fields: [],
  meta: { title, category: 'social', tags: ['template'] },
  pages: [{
    id: 'page-1',
    name: 'Page 1',
    duration: 4000,
    objects: [],
    background: { fill },
    animation: { layers: {} },
  }],
}

if (!args.blank) {
  document.pages[0].objects.push(
    {
      id: 'headline',
      type: 'textbox',
      name: '{headline}',
      left: margin,
      top: margin,
      width: width - margin * 2,
      text: 'Your headline',
      fontSize: headlineSize,
      fontFamily: 'Archivo Black',
      fontWeight: 'bold',
      fill: textFill,
      textAlign: 'left',
      lineHeight: 1.02,
      originX: 'left',
      originY: 'top',
    },
    {
      id: 'body',
      type: 'textbox',
      name: '{body}',
      left: margin,
      top: margin + headlineSize * 2.3,
      width: Math.round((width - margin * 2) * 0.8),
      text: 'Supporting copy that explains the offer in one or two lines.',
      fontSize: bodySize,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      fill: mutedFill,
      textAlign: 'left',
      lineHeight: 1.3,
      originX: 'left',
      originY: 'top',
    },
  )
  document.fields.push(
    { name: 'headline', targets: [{ objectId: 'headline', property: 'text' }] },
    { name: 'body', targets: [{ objectId: 'body', property: 'text' }] },
  )
}

const json = JSON.stringify(document, null, 2)

if (args.out) {
  await ensureParent(String(args.out))
  await writeFile(String(args.out), `${json}\n`, 'utf8')
  console.log(`Wrote ${args.out} (${width}x${height})`)
} else {
  process.stdout.write(`${json}\n`)
}
