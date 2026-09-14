export interface AgentToolInfo {
  name: string
  group: 'research' | 'content' | 'media' | 'delivery' | 'board' | 'skills' | 'safety'
  description: string
}

// Static catalog returned by GET /api/v1/agent/tools (PRD §7). This is the
// UI/oversight contract and the orchestrator's tool allowlist source.
export const AGENT_TOOL_CATALOG: AgentToolInfo[] = [
  { name: 'web_search', group: 'research', description: 'Search the live web with LangSearch and return source URLs for citations.' },
  { name: 'scan_trends', group: 'research', description: 'Scan best-performing posts and provider-assisted candidates to seed trend ideas.' },
  { name: 'scrape_url', group: 'research', description: 'Fetch and extract readable content from a safe external URL.' },
  { name: 'research_topic', group: 'research', description: 'Research a topic with citations and a content hash.' },
  { name: 'retrieve', group: 'research', description: 'Search the business knowledge base for relevant chunks.' },
  { name: 'write_post', group: 'content', description: 'Draft a platform-aware social post from the brief and context.' },
  { name: 'humanize', group: 'content', description: 'Rewrite a draft to sound natural while preserving claims.' },
  { name: 'revise_draft', group: 'content', description: 'Revise an existing draft from feedback and re-run checks.' },
  { name: 'check_seo', group: 'content', description: 'Run SEO checks and record findings.' },
  { name: 'check_geo', group: 'content', description: 'Run GEO (generative-engine) checks and record findings.' },
  { name: 'check_links', group: 'content', description: 'Validate links in an artifact and record findings.' },
  { name: 'download_video', group: 'media', description: 'Download a video with yt-dlp into the asset store.' },
  { name: 'create_carousel', group: 'media', description: 'Materialize an approved carousel artifact (2-10 Instagram slides).' },
  { name: 'create_reel_storyboard', group: 'media', description: 'Materialize a reel storyboard with ordered assets.' },
  { name: 'schedule_post', group: 'delivery', description: 'Schedule an approved artifact through the scheduler.' },
  { name: 'publish', group: 'delivery', description: 'Publish an approved artifact through the publishing service.' },
  { name: 'create_post', group: 'delivery', description: 'Create a post row from an approved artifact.' },
  { name: 'board_list', group: 'board', description: 'List content board cards for the session business.' },
  { name: 'board_move', group: 'board', description: 'Move a content card to an allowed state.' },
  { name: 'board_update', group: 'board', description: 'Update a content card title, brief, platforms, or priority.' },
  { name: 'board_add_cards', group: 'board', description: 'Add content cards to the board in idea state.' },
  { name: 'list_skills', group: 'skills', description: 'List bundled and registered skills available to the session.' },
  { name: 'load_skill', group: 'skills', description: 'Load a bundled skill body or a registered skill definition.' },
  { name: 'save_skill', group: 'skills', description: 'Save a draft skill for human review.' },
  { name: 'subagent', group: 'skills', description: 'Delegate a task to a predefined specialist agent in an isolated context.' },
  { name: 'pii_scan', group: 'safety', description: 'Detect or anonymize personal data before external side effects.' },
]

/** Tool names implemented by the agent layer (orchestrator allowlist source). */
export const AGENT_TOOL_NAMES: string[] = AGENT_TOOL_CATALOG.map(tool => tool.name)
