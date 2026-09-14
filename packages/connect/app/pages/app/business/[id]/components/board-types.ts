export interface BoardItem {
  id: string
  title: string
  brief: string
  state: string
  platforms: string[] | null
  priority: number
  artifactId: string | null
  scheduledAt: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BoardEvent {
  id: string
  event: string
  fromState: string | null
  toState: string | null
  actorKind: string
  payload: Record<string, unknown> | null
  createdAt: string
}

export interface BoardCheck {
  id: string
  kind: string
  status: string
  score: number | null
  findings: Record<string, unknown> | null
  createdAt: string
}

export interface BoardArtifact {
  id: string
  kind: string
  status: string
  version: number
  output: string | Record<string, unknown>
}

export interface BoardDetail {
  item: BoardItem
  events: BoardEvent[]
  checks: BoardCheck[]
  artifact: BoardArtifact | null
}

export interface BoardColumnDef {
  key: string
  states: string[]
}

// Seven canonical columns from the PRD, mapped onto the 13 item states.
export const BOARD_COLUMNS: BoardColumnDef[] = [
  { key: 'idea', states: ['idea'] },
  { key: 'research', states: ['researching', 'research_ready'] },
  { key: 'drafting', states: ['drafting', 'changes_requested'] },
  { key: 'review', states: ['review_required'] },
  { key: 'approved', states: ['approved', 'materializing', 'ready'] },
  { key: 'delivery', states: ['scheduled', 'published'] },
  { key: 'archive', states: ['archived', 'failed'] },
]

export const BOARD_ACTIONS: Record<string, string[]> = {
  idea: ['research', 'generate', 'archive'],
  researching: ['research', 'generate', 'archive'],
  research_ready: ['research', 'generate', 'archive'],
  drafting: ['improve', 'submit-review', 'archive'],
  changes_requested: ['improve', 'generate', 'archive'],
  review_required: ['improve', 'request-changes', 'approve', 'archive'],
  approved: ['materialize', 'archive'],
  ready: ['schedule', 'archive'],
  scheduled: ['publish', 'archive'],
  failed: ['research', 'generate', 'archive'],
}

// Drag-and-drop targets only plain state moves. Heavy actions (generate,
// materialize, schedule, publish) stay on buttons and menus — except
// generate, which is also the drop target for the drafting column so that
// dropping idea/research cards there runs the writer chain (research brief
// → platform variants → checks → review_required).
export const DROP_ACTION_COLUMN: Record<string, string> = {
  research: 'research',
  generate: 'drafting',
  'submit-review': 'review',
  'request-changes': 'drafting',
  approve: 'approved',
  archive: 'archive',
}

export function dropActionFor(itemState: string, columnKey: string): string | null {
  for (const action of BOARD_ACTIONS[itemState] ?? []) {
    if (DROP_ACTION_COLUMN[action] === columnKey) return action
  }
  return null
}

export const ACTION_ICONS: Record<string, string> = {
  research: 'i-heroicons-magnifying-glass',
  generate: 'i-heroicons-sparkles',
  improve: 'i-heroicons-wrench-screwdriver',
  materialize: 'i-heroicons-cube',
  'submit-review': 'i-heroicons-clipboard-document-check',
  'request-changes': 'i-heroicons-arrow-uturn-left',
  approve: 'i-heroicons-check-badge',
  schedule: 'i-heroicons-calendar-days',
  publish: 'i-heroicons-paper-airplane',
  archive: 'i-heroicons-archive-box',
}

// The one action that moves this state forward — shown as the drawer's
// primary "next step" button; everything else lands in the overflow menu.
export const PRIMARY_ACTION: Record<string, string> = {
  idea: 'research',
  researching: 'research',
  research_ready: 'generate',
  drafting: 'submit-review',
  changes_requested: 'improve',
  review_required: 'approve',
  approved: 'materialize',
  ready: 'schedule',
  scheduled: 'publish',
  failed: 'research',
}

export const ACTION_I18N: Record<string, string> = {
  research: 'research',
  generate: 'generate',
  improve: 'improve',
  materialize: 'materialize',
  'submit-review': 'submitReview',
  'request-changes': 'requestChanges',
  approve: 'approve',
  schedule: 'schedule',
  publish: 'publish',
  archive: 'archive',
}

export const COMMON_PLATFORMS = [
  'facebook',
  'instagram',
  'twitter',
  'linkedin',
  'tiktok',
  'youtube',
  'threads',
  'bluesky',
  'reddit',
  'wordpress',
]

export type BadgeColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

export function stateColor(state: string): BadgeColor {
  if (state === 'published' || state === 'ready') return 'success'
  if (state === 'review_required' || state === 'changes_requested') return 'warning'
  if (state === 'failed') return 'error'
  if (state === 'scheduled' || state === 'approved') return 'info'
  if (state === 'archived') return 'neutral'
  return 'primary'
}
