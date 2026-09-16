/**
 * Minimal synchronous chat-markdown renderer (subset: headings, bold, italic,
 * inline code, links, unordered/ordered lists, fenced code, paragraphs).
 * MDC cannot be used here: its client-side `parseMarkdown` dynamic import
 * does not resolve in this app, so `<MDC>` renders raw source text.
 * Output is HTML-escaped first, so `v-html` below is XSS-safe by construction.
 */

export interface MarkdownRenderState {
  inCode: boolean
  codeBuf: string[]
  listTag: 'ul' | 'ol' | null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderInline(text: string): string {
  const safe = escapeHtml(text)
  const withCode = safe.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  const withItalic = withBold.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  return withItalic.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}

function closeList(html: string[], state: MarkdownRenderState): void {
  if (!state.listTag) return
  html.push(`</${state.listTag}>`)
  state.listTag = null
}

function flushCode(html: string[], state: MarkdownRenderState): void {
  html.push(`<pre><code>${escapeHtml(state.codeBuf.join('\n'))}</code></pre>`)
  state.codeBuf = []
  state.inCode = false
}

function tryFence(line: string, html: string[], state: MarkdownRenderState): boolean {
  if (!line.trim().startsWith('```')) return false
  if (state.inCode) flushCode(html, state)
  else {
    closeList(html, state)
    state.inCode = true
  }
  return true
}

function tryHeading(line: string, html: string[], state: MarkdownRenderState): boolean {
  const heading = line.match(/^(#{1,4})\s+(.*)$/)
  if (!heading) return false
  closeList(html, state)
  const level = heading[1].length
  html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
  return true
}

function pushListItem(html: string[], state: MarkdownRenderState, tag: 'ul' | 'ol', text: string): void {
  if (state.listTag !== tag) {
    closeList(html, state)
    html.push(`<${tag}>`)
    state.listTag = tag
  }
  html.push(`<li>${renderInline(text)}</li>`)
}

function tryListItem(line: string, html: string[], state: MarkdownRenderState): boolean {
  const unordered = line.match(/^\s*[-*]\s+(.*)$/)
  const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
  if (!unordered && !ordered) return false
  const tag = unordered ? 'ul' : 'ol'
  pushListItem(html, state, tag, (unordered ?? ordered)?.[1] ?? '')
  return true
}

function parseLine(line: string, html: string[], state: MarkdownRenderState): void {
  if (tryFence(line, html, state)) return
  if (state.inCode) {
    state.codeBuf.push(line)
    return
  }
  if (tryHeading(line, html, state)) return
  if (tryListItem(line, html, state)) return
  closeList(html, state)
  if (line.trim() !== '') html.push(`<p>${renderInline(line.trim())}</p>`)
}

export function renderChatMarkdown(src: string): string {
  const html: string[] = []
  const state: MarkdownRenderState = { inCode: false, codeBuf: [], listTag: null }
  for (const line of src.split('\n')) parseLine(line, html, state)
  if (state.inCode) flushCode(html, state)
  closeList(html, state)
  return html.join('')
}
