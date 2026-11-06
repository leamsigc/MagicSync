import type { ImageEditorDocument } from './document'

/**
 * Font-family collection shared by the browser preview and the server
 * renderer, so both register/load exactly the document's families.
 */

function styleFonts(doc: ImageEditorDocument): string[] {
  const out: string[] = []
  for (const page of doc.pages) {
    for (const obj of page.objects) {
      collectFromObject(obj, out)
    }
    for (const field of doc.fields) {
      const font = field.default?.font_family
      if (typeof font === 'string') out.push(font)
    }
  }
  return out
}

function collectFromObject(obj: Record<string, unknown>, out: string[]) {
  if (typeof obj.fontFamily === 'string' && obj.fontFamily) out.push(obj.fontFamily)
  const styles = obj.styles
  if (styles && typeof styles === 'object' && !Array.isArray(styles)) {
    for (const line of Object.values(styles)) {
      if (!line || typeof line !== 'object' || Array.isArray(line)) continue
      for (const style of Object.values(line as Record<string, unknown>)) {
        if (style && typeof style === 'object' && typeof (style as Record<string, unknown>).fontFamily === 'string') {
          out.push((style as Record<string, unknown>).fontFamily as string)
        }
      }
    }
  }
  const children = obj.objects
  if (Array.isArray(children)) {
    for (const child of children) collectFromObject(child as Record<string, unknown>, out)
  }
}

export function documentPagesFonts(doc: ImageEditorDocument): string[] {
  const families = styleFonts(doc)
  return [...new Set(families)]
}

/** Object-type list supported by the field `text` suffix. */
export const TEXT_OBJECT_TYPES = ['textbox', 'i-text', 'itext', 'text']
