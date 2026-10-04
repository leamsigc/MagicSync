export interface AgentToolInfo {
  name: string
  group: 'research' | 'content' | 'media' | 'delivery' | 'board' | 'skills' | 'safety' | 'orchestration'
  description: string
}

// Static tool catalog (PRD §7), embedded in GET /api/v1/agent/capabilities.
// This is the UI/oversight contract — what a client may ask for and what the
// oversight UI lists. It is NOT a mount: since T28 an agent mounts its own
// handful through `agent/tools/mounts.ts` (`CHAT_AGENT_MOUNT`,
// `SPECIALIST_SESSION_PROFILES[].tools`), because a turn may offer at most
// `MAX_TOOLS_PER_TURN` tools. `subagent` is retained here as retired history —
// delegation is Flue's built-in `task` tool (T27).
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
  { name: 'generate_carousel', group: 'content', description: 'Generate a platform-neutral carousel artifact from an approved source.' },
  { name: 'revise_carousel', group: 'content', description: 'Revise an existing carousel artifact into a new version from feedback.' },
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
  { name: 'execute_goal', group: 'orchestration', description: 'Plan and execute a business-owner goal end to end with verified steps.' },
  { name: 'inspect_destination', group: 'delivery', description: 'Inspect a GitHub repo or WordPress site to discover content structure and template.' },
  { name: 'discover_repository_content', group: 'delivery', description: 'List content directories and sample files for a GitHub repo.' },
  { name: 'preview_publication', group: 'delivery', description: 'Preview exact target path, template and branch before generating content.' },
  { name: 'prepare_github_article', group: 'delivery', description: 'Prepare a GitHub blog article artifact for approval.' },
  { name: 'prepare_wordpress_article', group: 'delivery', description: 'Prepare a WordPress post artifact for approval.' },
  { name: 'publish_content', group: 'delivery', description: 'Publish an approved artifact through the destination adapter.' },
  { name: 'verify_publication', group: 'delivery', description: 'Verify branch, file, commit and PR after publishing.' },
]

/** Every catalogued tool name (the UI/oversight surface, not a mount). */
export const AGENT_TOOL_NAMES: string[] = AGENT_TOOL_CATALOG.map(tool => tool.name)
