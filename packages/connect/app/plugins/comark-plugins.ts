import { defineComarkPlugin } from 'comark'
import type { ElementNode, MarkdownDocument, Node } from 'comark'
import type { SeoFindings } from '../utils/comark-seo'
import { parseMarkdownFindings } from '../utils/comark-seo'

export interface SocialDrafts {
  thread: string[]
  linkedin: string
  instagram: string
}

export interface EditorAuditContext {
  seo: SeoFindings
  socialDrafts: SocialDrafts
}

function nodeText(node: Node): string {
  if (typeof node === 'string') return node
  if (!Array.isArray(node)) return ''
  return node.slice(2).map(child => nodeText(child as Node)).join('')
}

function documentText(tree: MarkdownDocument): string {
  return tree.nodes.map(node => nodeText(node)).join('\n')
}

/** Comark AST plugin that adds the editor's SEO findings to document metadata. */
export const comarkSeoPlugin = defineComarkPlugin(() => ({
  name: 'magicsync-seo',
  post(state) {
    const markdown = documentText(state.tree)
    state.tree.meta.seo = parseMarkdownFindings(markdown)
  },
}))

/** Comark AST plugin that exposes paragraph highlights for social drafts. */
export const comarkSocialDraftsPlugin = defineComarkPlugin(() => ({
  name: 'magicsync-social-drafts',
  post(state) {
    const highlights = state.tree.nodes
      .filter((node): node is ElementNode => Array.isArray(node) && node[0] === 'p')
      .map(nodeText)
      .filter(text => text.length > 40)
      .slice(0, 3)
    state.tree.meta.socialHighlights = highlights
  },
}))

/** Build the plugin list once per render; Comark deduplicates by plugin name. */
export function editorComarkPlugins() {
  return [comarkSeoPlugin(), comarkSocialDraftsPlugin()]
}

export function runSeoAudit(markdown: string): SeoFindings {
  return parseMarkdownFindings(markdown)
}

export function runSocialDrafts(markdown: string): SocialDrafts {
  const highlights = markdown
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .map(line => line.replace(/^#{1,6}\s+|^[-*]\s+|[*_>`]/g, '').trim())
    .filter(line => line.length > 40)
    .slice(0, 3)
  const thread = highlights.flatMap(highlight => chunkTweet(highlight)).slice(0, 5)
  return {
    thread,
    linkedin: highlights.slice(0, 2).join('\n\n'),
    instagram: highlights[0] ?? '',
  }
}

function chunkTweet(text: string, max = 240): string[] {
  if (text.length <= max) return [text]
  const parts: string[] = []
  let current = ''
  for (const word of text.split(/\s+/)) {
    if (current && `${current} ${word}`.length > max) {
      parts.push(current)
      current = word
    }
    else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) parts.push(current)
  return parts
}

export default defineNuxtPlugin(() => {})
