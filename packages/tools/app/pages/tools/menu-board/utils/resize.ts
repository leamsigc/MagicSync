/**
 * Resize a px-based page HTML so it fills a different target stage size.
 * Idempotent: stores the original design size in a data attribute on first
 * run so repeated resizes never compound scaling. Pages that use viewport
 * units (100vw/100vh templates) auto-adapt already and are left untouched.
 */
export function fitHtmlToStage(
  html: string,
  targetW: number,
  targetH: number,
): { html: string, fitted: boolean } {
  const rootMatch = html.match(/^<div([^>]*)>([\s\S]*)$/)
  if (!rootMatch) return { html, fitted: false }

  const attrs = rootMatch[1] ?? ''
  const inner = rootMatch[2] ?? ''

  const styleMatch = attrs.match(/style="([^"]*)"/)
  if (!styleMatch) return { html, fitted: false }
  const style = styleMatch[1] ?? ''

  const designMatch = attrs.match(/data-design="(\d+)x(\d+)"/)
  const widthMatch = style.match(/(?:^|;)\s*width:\s*(\d+(?:\.\d+)?)px/)
  const heightMatch = style.match(/(?:^|;)\s*height:\s*(\d+(?:\.\d+)?)px/)
  if (!widthMatch || !heightMatch) return { html, fitted: false }

  const designW = designMatch ? Number(designMatch[1]) : Number(widthMatch[1])
  const designH = designMatch ? Number(designMatch[2]) : Number(heightMatch[1])
  if (!designW || !designH) return { html, fitted: false }

  const scale = Math.min(targetW / designW, targetH / designH)

  let newStyle = style
    .replace(/(?:^|;)\s*width:\s*\d+(?:\.\d+)?px/, `;width:${targetW}px`)
    .replace(/(?:^|;)\s*height:\s*\d+(?:\.\d+)?px/, `;height:${targetH}px`)
    .replace(/(?:^|;)\s*zoom:\s*[\d.]+/g, '')
    .replace(/;;+/g, ';')
  newStyle = `${newStyle.replace(/;\s*$/, '')};zoom:${scale.toFixed(4)}`

  let newAttrs = attrs
    .replace(/style="[^"]*"/, `style="${newStyle}"`)
    .replace(/\s*data-design="[^"]*"/, '')
  newAttrs = `${newAttrs} data-design="${designW}x${designH}"`

  return { html: `<div${newAttrs}>${inner}`, fitted: true }
}
