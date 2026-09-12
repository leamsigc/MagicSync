// MagicSync tool bridge for deepseek-harness.
//
// Each tool below mirrors a ToolManager tool in the Python backend
// (see app/services/tools/manager.py). execute() forwards to the
// FastAPI bridge; all real logic stays in Python. Keep names and
// required args in sync — tests/api/test_dsh.py asserts catalog parity.

import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'magicsync-tools'
export const inject = ['tools']

const BRIDGE_URL = process.env.MAGICSYNC_BRIDGE_URL || 'http://127.0.0.1:8000/api/v1/dsh'
const BRIDGE_SECRET = process.env.MAGICSYNC_BRIDGE_SECRET || ''
// The bridge never trusts caller-supplied user ids: legacy calls execute as
// the unprivileged 'dsh' identity, scoped runs present a capability token.
const BRIDGE_CAPABILITY = process.env.MAGICSYNC_BRIDGE_CAPABILITY || ''

async function callBridge(tool, args, exec) {
  const response = await fetch(`${BRIDGE_URL}/tools/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bridge-Secret': BRIDGE_SECRET,
    },
    body: JSON.stringify({
      tool,
      args,
      capability: BRIDGE_CAPABILITY || undefined,
      business_id: process.env.MAGICSYNC_BRIDGE_BUSINESS || undefined,
      run_id: process.env.MAGICSYNC_BRIDGE_RUN || undefined,
    }),
    signal: exec.signal,
  })
  if (!response.ok) {
    throw new Error(`bridge ${tool} failed with HTTP ${response.status}`)
  }
  const data = await response.json()
  return data.result ?? null
}

function bridgeTool(def) {
  return defineTool({
    ...def,
    output: {
      schema: {},
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      return callBridge(def.name, args, exec)
    },
  })
}

const str = (description, required = false) => ({ type: 'string', description, ...(required ? { required: true } : {}) })
const num = (description, def) => ({ type: 'number', description, ...(def !== undefined ? { default: def } : {}) })
const bool = (description, def) => ({ type: 'boolean', description, ...(def !== undefined ? { default: def } : {}) })

const TOOL_DEFS = [
  {
    name: 'web_search',
    description: 'Search the web for current information, trends, news.',
    parameters: { query: str('The search query', true), max_results: num('Max results', 5) },
  },
  {
    name: 'scrape_url',
    description: 'Extract specific information from a web page as structured data.',
    parameters: { url: str('Page URL', true), prompt: str('What to extract', true) },
  },
  {
    name: 'retrieve',
    description: 'Semantic search over the user knowledge base.',
    parameters: { query: str('Search query', true), top_k: num('Results', 5) },
  },
  {
    name: 'hybrid_search',
    description: 'Hybrid keyword+vector search across user documents.',
    parameters: { query: str('Search query', true), limit: num('Max results', 10) },
  },
  {
    name: 'virality_check',
    description: 'Score a published post or draft for virality (0-100 + tier).',
    parameters: { post_id: str('Published post id'), content: str('Draft content') },
  },
  {
    name: 'engagement_calc',
    description: 'Compute engagement rates for a list of post ids.',
    parameters: { post_ids: { type: 'array', description: 'Post ids', items: { type: 'string' } } },
  },
  {
    name: 'best_posts',
    description: 'Top posts by engagement over the last N days.',
    parameters: { days: num('Lookback days', 7), platform: str('Platform filter'), limit: num('Max posts', 5) },
  },
  {
    name: 'destructure_post',
    description: 'Extract a reusable template (hook/structure/CTA/tone) from a post.',
    parameters: { post_id: str('Post id', true) },
  },
  {
    name: 'apply_template',
    description: 'Apply a saved template to a new theme; returns outline + draft notes.',
    parameters: {
      template: { type: 'object', description: 'Template from destructure_post', required: true },
      theme: str('New theme', true),
      business_context: str('Business context to ground the draft'),
    },
  },
  {
    name: 'list_skills',
    description: 'List available agent skills (name + description).',
    parameters: {},
  },
  {
    name: 'load_skill',
    description: 'Load full instructions for a skill by name.',
    parameters: { skill_name: str('Skill name', true) },
  },
  {
    name: 'generate_social_post',
    description: 'Generate a social media post for a specific platform.',
    parameters: { topic: str('The main topic or theme of the post', true), platform: str('Target platform', true) },
  },
  {
    name: 'generate_thread',
    description: 'Generate a thread/tweetstorm for platforms that support it.',
    parameters: { topic: str('The thread topic or theme', true) },
  },
  {
    name: 'generate_hashtags',
    description: 'Generate optimized hashtags for a topic and platform.',
    parameters: { topic: str('The post topic', true), platform: str('Target platform', true) },
  },
]

export function apply(ctx) {
  for (const def of TOOL_DEFS) {
    ctx.tools.register(bridgeTool(def))
  }
}
