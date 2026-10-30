/**
 * Agent brand registry for the content components.
 *
 * Icons use the `logos:` collection (matches the brand marks the site already
 * uses for platforms); agents without a brand mark fall back to a Lucide icon.
 * Descriptions come from `navigation.agentDesc.*` in the global translations.
 */
export interface AgentBrand {
  slug: string
  name: string
  icon: string
}

export const AGENT_BRANDS: AgentBrand[] = [
  { slug: 'chatgpt', name: 'ChatGPT', icon: 'selfhst:chatgpt' },
  { slug: 'claude', name: 'Claude', icon: 'logos:claude-icon' },
  { slug: 'claude-code', name: 'Claude Code', icon: 'logos:claude-code' },
  { slug: 'codex', name: 'Codex', icon: 'logos:codex-dark' },
  { slug: 'cursor', name: 'Cursor', icon: 'devicon:cursor' },
  { slug: 'openclaw', name: 'OpenClaw', icon: 'thesvg-color:openclaw' },
  { slug: 'hermes-agent', name: 'Hermes Agent', icon: 'selfhst:hermes-agent-light' },
  { slug: 'grok-bot', name: 'Grok Bot', icon: 'thesvg:grok-xai' },
  { slug: 'grok-build', name: 'Grok Build', icon: 'thesvg:grok-xai' },
  { slug: 'muse', name: 'Muse', icon: 'i-lucide:sparkles' },
  { slug: 'perplexity-computer', name: 'Perplexity Computer', icon: 'selfhst:perplexity-ai' },
  { slug: 'nanoclaw', name: 'nanoclaw', icon: 'i-lucide:message-circle' },
  { slug: 'paperclip', name: 'Paperclip', icon: 'i-lucide:paperclip' },
  { slug: 'mcp', name: 'MCP Server', icon: 'i-lucide:server' },
  { slug: 'agent', name: 'AI Agents CLI', icon: 'i-lucide:terminal' },
]

/** Translation key under `navigation.agentDesc.*`. */
const DESC_KEYS: Record<string, string> = {
  chatgpt: 'chatgpt',
  claude: 'claude',
  'claude-code': 'claudeCode',
  codex: 'codex',
  cursor: 'cursor',
  openclaw: 'openclaw',
  'hermes-agent': 'hermes',
  'grok-bot': 'grokBot',
  'grok-build': 'grokBuild',
  muse: 'muse',
  'perplexity-computer': 'perplexity',
  nanoclaw: 'nanoclaw',
  paperclip: 'paperclip',
  mcp: 'mcp',
  agent: 'cli',
}

const PLATFORM_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  threads: 'Threads',
  bluesky: 'Bluesky',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  discord: 'Discord',
  dribbble: 'Dribbble',
  devto: 'DEV',
  wordpress: 'WordPress',
  mastodon: 'Mastodon',
  snapchat: 'Snapchat',
  google: 'Google Business',
  'google-my-business': 'Google Business',
}

export function agentBrand(slug: string): AgentBrand {
  return AGENT_BRANDS.find(agent => agent.slug === slug) ?? { slug, name: slug, icon: 'i-lucide:bot' }
}

export function agentDescription(slug: string): string {
  const key = DESC_KEYS[slug] ?? slug
  return `navigation.agentDesc.${key}`
}

export function platformName(slug: string): string {
  return PLATFORM_NAMES[slug] ?? slug
}
