import { contentApiError, contentApiErrorCode } from '../utils/content-api-error'

/**
 * The whole data surface of the content board and the idea view
 * (PRD-CONTENT-PIPELINE-OVERHAUL §1.1–1.2).
 *
 * Three composables share one file because they share one model:
 * - `usePublishTargets` — the owner's active WordPress / GitHub connections.
 * - `useContentBoard`   — four columns, and the action each drop runs.
 * - `useContentEditor`  — one item: its article, its checks, its social posts.
 *
 * Two rules shape everything below.
 *
 * **The server is the authority.** A plain move is applied optimistically so the
 * card lands under the cursor, but every action ends in a reload, and a failure
 * restores the snapshot taken before the move. A state the server did not
 * accept is never shown.
 *
 * **A drop triggers the target column's action, not the source state's.** Drag
 * backwards runs no agent work, with one exception: Writing always re-runs
 * `content.write`, so Writing ← Approved is a re-draft rather than a move.
 */

export interface ContentSource {
  label: string
  url?: string
}

export interface ContentItemView {
  id: string
  title: string
  brief: string
  state: string
  platforms: string[] | null
  artifactId?: string | null
  postId?: string | null
  priority?: number
  createdAt?: string | null
  updatedAt?: string | null
  publishedAt?: string | null
}

export interface ContentCheckView {
  id: string
  kind: string
  status: string
  score: number | null
  findings?: Record<string, unknown> | null
}

export interface ContentArtifactView {
  id: string
  kind: string
  status: string
  version: number
  output: string | Record<string, unknown>
}

export interface ContentItemDetail {
  item: ContentItemView
  events?: unknown[]
  checks: ContentCheckView[]
  artifact: ContentArtifactView | null
}

export interface PublishOutcome {
  itemId: string
  artifactId: string
  jobId: string
  postId: string
  /** Which body went out: the target's own variant, the shared article, or the caption. */
  variant: string
}

/** One platform's version of the article, as the artifact stores it (PRD §10 D07). */
export interface ContentVariantView {
  platform: string
  body: string
  keywords: string[]
  notes: string
}

/** The key the shared article is read and edited under; it is not a variant. */
export const ARTICLE_KEY = 'article'

/**
 * WordPress and GitHub bodies are written for search and AI answers; every other
 * target is written for the platform's own reaction (PRD §10 D07). `default` is
 * the writer's own no-platform body and `caption` what a materialised artifact
 * falls back to — both are the shared copy rather than a written version.
 */
const SHARED_TARGETS = ['default', 'caption']
const SEARCH_TARGETS = ['article', 'wordpress', 'github']

export function variantIntent(platform: string): 'search' | 'social' | 'shared' {
  if (SHARED_TARGETS.includes(platform)) return 'shared'
  return SEARCH_TARGETS.includes(platform) ? 'search' : 'social'
}

/** The four board columns, always in this order. */
export type ContentColumnKey = 'planned' | 'approved' | 'writing' | 'published'

/** What dropping a card into a column does. */
export type ContentBoardAction = 'move' | 'write' | 'publish'

export interface ContentConnection {
  id: string
  provider: 'github' | 'wordpress'
  name: string
  config: string
  deliveryMode: string
  isActive: boolean
  hasSecret: boolean
  secret: string | null
}

/** A connection the UI is allowed to publish to. */
export interface ContentTargetOption {
  id: string
  provider: string
  name: string
  /** `owner/name` for GitHub, the site URL for WordPress. */
  detail: string
  url: string
}

export interface ContentPlatformPost {
  platform: string
  caption: string
}

export interface ContentFindingLine {
  key: string
  detail: string
}

export const BOARD_COLUMN_ORDER: ContentColumnKey[] = ['planned', 'approved', 'writing', 'published']

/** States each column holds. `failed` recovers into Planned; `archived` is gone. */
const BOARD_COLUMN_STATES: Record<ContentColumnKey, string[]> = {
  planned: ['idea', 'failed'],
  approved: ['review_required'],
  writing: ['drafting'],
  published: ['scheduled', 'published'],
}

const BOARD_COLUMN_TARGET: Record<ContentColumnKey, string> = {
  planned: 'idea',
  approved: 'review_required',
  writing: 'drafting',
  published: 'published',
}

/** Capability code for "no confirm flag" — the server's half of Safe Mode. */
const CONFIRMATION_REQUIRED = 'CONFIRMATION_REQUIRED'

const BOARD_SUCCESS_KEY: Record<ContentBoardAction, string> = {
  move: 'board.moved',
  write: 'board.written',
  publish: 'board.published',
}

const BOARD_FAIL_KEY: Record<ContentBoardAction, string> = {
  move: 'board.moveFailed',
  write: 'board.writeFailed',
  publish: 'board.publishFailed',
}

// ── Column model ────────────────────────────────────────────────────────

export function columnForState(state: string | undefined | null): ContentColumnKey | null {
  return BOARD_COLUMN_ORDER.find(key => BOARD_COLUMN_STATES[key].includes(state ?? '')) ?? null
}

/** Writing runs the writer chain; Published approves and releases; the rest move. */
export function actionForColumn(column: ContentColumnKey): ContentBoardAction {
  if (column === 'writing') return 'write'
  if (column === 'published') return 'publish'
  return 'move'
}

export function stateForColumn(column: ContentColumnKey): string {
  return BOARD_COLUMN_TARGET[column]
}

/** The column one step left or right, or `null` at either end of the board. */
export function adjacentColumn(column: ContentColumnKey, direction: 1 | -1): ContentColumnKey | null {
  return BOARD_COLUMN_ORDER[BOARD_COLUMN_ORDER.indexOf(column) + direction] ?? null
}

/**
 * Board columns each state may legally be dragged to, mirroring the server's
 * `CONTENT_ITEM_TRANSITIONS` (packages/db/.../content-board.service.ts).
 *
 * The workflow is write-first: an idea has no draft to review, so Planned cannot
 * reach Approved, and a draft is only published through the artifact gate rather
 * than by dropping it on Published. The board used to advertise every adjacent
 * pair anyway, so a legal-looking drag ended in `INVALID_TRANSITION`.
 */
const LEGAL_MOVE_COLUMNS: Record<string, ContentColumnKey[]> = {
  idea: ['writing'],
  failed: ['planned'],
  drafting: ['planned', 'approved'],
  review_required: ['writing'],
  scheduled: ['published'],
  published: ['approved'],
}

/** Whether `item` may legally land on `column` — same column is a no-op, not a move. */
export function canMoveTo(item: Pick<ContentItemView, 'state'>, column: ContentColumnKey): boolean {
  return (LEGAL_MOVE_COLUMNS[item.state] ?? []).includes(column)
}

/**
 * The nearest column in `direction` the item may legally move to, or `null`.
 * Skips columns the state machine forbids so the arrow buttons always do
 * something real rather than failing after the round trip.
 */
export function nextLegalColumn(item: Pick<ContentItemView, 'state'>, direction: 1 | -1): ContentColumnKey | null {
  const from = BOARD_COLUMN_ORDER.indexOf(columnForState(item.state) ?? 'planned')
  const step = direction > 0 ? 1 : -1
  for (let i = from + step; i >= 0 && i < BOARD_COLUMN_ORDER.length; i += step) {
    const candidate = BOARD_COLUMN_ORDER[i]
    if (candidate && canMoveTo(item, candidate)) return candidate
  }
  return null
}

// ── Pure helpers ────────────────────────────────────────────────────────

function tryParseObject(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  }
  catch {
    return {}
  }
}

function parseOutput(output: unknown): Record<string, unknown> {
  if (output && typeof output === 'object') return output as Record<string, unknown>
  return typeof output === 'string' ? tryParseObject(output) : {}
}

function firstString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value) return value
  }
  return ''
}

/**
 * Artifacts written before the recovery fix hold the writer's raw JSON
 * envelope inside `caption`; unwrap it so the editor never shows JSON.
 */
function unwrapEnvelope(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return text
  return firstString(parseOutput(trimmed), ['article', 'caption']) || text
}

export function articleFromOutput(output: unknown): string {
  return unwrapEnvelope(firstString(parseOutput(output), ['article', 'caption', 'content', 'markdown']))
}

/** A variant may be a bare string or the writer chain's `{ caption }` record. */
function variantCaption(variant: unknown): string {
  if (typeof variant === 'string') return variant
  const caption = (variant as { caption?: unknown } | null)?.caption
  return typeof caption === 'string' ? caption : ''
}

/** The per-platform copies, flattened; entries with no caption are dropped. */
export function platformPostsFromOutput(output: unknown): ContentPlatformPost[] {
  const raw = parseOutput(output).platformVariants
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  return Object.entries(raw as Record<string, unknown>)
    .map(([platform, variant]) => ({ platform, caption: variantCaption(variant) }))
    .filter(post => post.caption.length > 0)
}

/** One `variants` entry, or `null` when the stored body is missing. */
function variantEntry(raw: unknown): Omit<ContentVariantView, 'platform'> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const entry = raw as Record<string, unknown>
  const body = typeof entry.body === 'string' ? entry.body : ''
  if (!body) return null
  const tags = Array.isArray(entry.keywords) ? entry.keywords : []
  return { body, keywords: tags.filter(tag => typeof tag === 'string'), notes: typeof entry.notes === 'string' ? entry.notes : '' }
}

/**
 * The stored `variants` map beside `article` (PRD §10 D07), in the artifact's own
 * order, with an entry that carries no body dropped — the switcher has nothing
 * to show for it.
 */
export function variantsFromOutput(output: unknown): ContentVariantView[] {
  const raw = parseOutput(output).variants
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const entries: ContentVariantView[] = []
  for (const [platform, value] of Object.entries(raw as Record<string, unknown>)) {
    const entry = variantEntry(value)
    if (entry) entries.push({ ...entry, platform })
  }
  return entries
}

/** `config` arrives as a JSON string — see `publish.vue` for the same parse. */
export function parseConnectionConfig(raw: string): Record<string, unknown> {
  return tryParseObject(raw)
}

function connectionDetail(provider: string, config: Record<string, unknown>): string {
  if (provider === 'github') return String(config.repo ?? config.repository ?? '')
  return String(config.siteUrl ?? config.url ?? '')
}

function connectionUrl(provider: string, config: Record<string, unknown>): string {
  const detail = connectionDetail(provider, config)
  if (!detail) return ''
  if (provider !== 'github') return detail
  return `https://github.com/${detail.replace(/^https?:\/\/github\.com\//, '')}`
}

/** Only an active connection that still holds its secret can publish. */
export function targetOption(row: ContentConnection): ContentTargetOption | null {
  if (!row.isActive || !row.hasSecret) return null
  const config = parseConnectionConfig(row.config)
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    detail: connectionDetail(row.provider, config),
    url: connectionUrl(row.provider, config),
  }
}

function scalarText(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  return ''
}

/** `probes` entries carry `{ url, ok, status }`; render them as `url · status`. */
function objectText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return joinFinding(String(record.url ?? record.label ?? ''), String(record.status ?? record.reason ?? ''))
}

function joinFinding(label: string, detail: string): string | null {
  if (!label && !detail) return null
  return detail ? `${label} · ${detail}` : label
}

function findingLinesFor(key: string, values: unknown[]): ContentFindingLine[] {
  return values.map(value => ({ key, detail: objectText(value) ?? scalarText(value) }))
}

/** `findings` is a loose record per check; flatten it into displayable lines. */
export function findingLines(findings: Record<string, unknown> | null | undefined): ContentFindingLine[] {
  if (!findings) return []
  const lines: ContentFindingLine[] = []
  for (const [key, value] of Object.entries(findings)) {
    if (Array.isArray(value)) lines.push(...findingLinesFor(key, value))
    else lines.push({ key, detail: scalarText(value) })
  }
  return lines
}

export function countWords(markdown: string): number {
  return markdown.split(/\s+/).filter(Boolean).length
}

/** The item's artifact, or `null` when the card has nothing to release yet. */
async function loadArtifact(businessId: string, itemId: string): Promise<ContentArtifactView | null> {
  const detail = await $fetch<ContentItemDetail>(`/api/v1/content-items/${itemId}`, { query: { businessId } })
  return detail.artifact ?? null
}

/**
 * Publishing re-checks approval on the exact artifact version, so both the
 * board's drop and the idea view approve before they release. Shared here
 * because the gate is the same rule, not two.
 */
async function approveArtifact(businessId: string, artifact: ContentArtifactView) {
  if (artifact.status === 'approved') return
  await $fetch(`/api/v1/artifacts/${artifact.id}/review`, {
    method: 'POST',
    query: { businessId },
    body: { decision: 'approved', feedback: '', version: artifact.version },
  })
}

// ── Publish targets ─────────────────────────────────────────────────────

/**
 * The owner's own connections, filtered to the ones that can actually publish:
 * active, and holding a secret. `targetUrl` is what the `View Site →` control
 * opens — the repo for GitHub, the site for WordPress.
 */
export function usePublishTargets(options: { businessId: string }) {
  const { t } = useI18n()
  const toast = useToast()

  const targets = ref<ContentTargetOption[]>([])
  const targetId = ref('')
  const targetsLoading = ref(false)

  const selected = computed(() => targets.value.find(target => target.id === targetId.value) ?? null)
  const provider = computed(() => selected.value?.provider ?? '')
  const targetUrl = computed(() => selected.value?.url ?? '')

  function keepSelection(list: ContentTargetOption[]) {
    if (list.some(target => target.id === targetId.value)) return
    targetId.value = list[0]?.id ?? ''
  }

  async function loadTargets() {
    targetsLoading.value = true
    try {
      const response = await $fetch<{ success?: boolean, data?: ContentConnection[] }>('/api/v1/publishing/connections', {
        query: { businessId: options.businessId },
      })
      targets.value = (response.data ?? []).map(targetOption).filter(Boolean) as ContentTargetOption[]
      keepSelection(targets.value)
    }
    catch (error) {
      targets.value = []
      targetId.value = ''
      log.error({ message: 'publish targets failed to load', businessId: options.businessId })
      toast.add({ title: t('board.target.failed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
    }
    finally {
      targetsLoading.value = false
    }
  }

  return { loadTargets, targetsLoading, provider, selected, targetId, targetUrl, targets }
}

// ── The board ───────────────────────────────────────────────────────────

export function useContentBoard(options: { businessId: string }) {
  const { t } = useI18n()
  const toast = useToast()
  const publishTargets = usePublishTargets(options)

  const items = ref<ContentItemView[]>([])
  const loading = ref(true)
  /** The card whose action is running; the whole board locks behind it. */
  const busyId = ref<string | null>(null)
  const switchingMode = ref(false)
  const safeMode = ref(true)

  const locked = computed(() => busyId.value !== null)

  const columns = computed(() => BOARD_COLUMN_ORDER.map(key => ({
    key,
    items: items.value.filter(item => BOARD_COLUMN_STATES[key].includes(item.state)),
  })))

  async function load() {
    loading.value = true
    try {
      const response = await $fetch<{ items?: ContentItemView[] }>('/api/v1/content-items', {
        query: { businessId: options.businessId },
      })
      items.value = (response.items ?? []).filter(item => item.state !== 'archived')
    }
    catch (error) {
      items.value = []
      log.error({ message: 'content board failed to load', businessId: options.businessId })
      toast.add({ title: t('board.failed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
    }
    finally {
      loading.value = false
    }
  }

  async function loadSafeMode() {
    try {
      const response = await $fetch<{ safeMode: boolean }>(`/api/v1/business/${options.businessId}/safe-mode`)
      safeMode.value = response.safeMode
    }
    catch {
      // Fail closed: without the setting the control stays two-step.
      safeMode.value = true
    }
  }

  async function toggleSafeMode() {
    if (switchingMode.value) return
    switchingMode.value = true
    try {
      const response = await $fetch<{ safeMode: boolean }>(`/api/v1/business/${options.businessId}/safe-mode`, {
        method: 'PUT',
        body: { safeMode: !safeMode.value },
      })
      safeMode.value = response.safeMode
      toast.add({
        title: t(response.safeMode ? 'board.mode.safeOn' : 'board.mode.safeOff'),
        icon: 'i-heroicons-shield-check',
        color: 'success',
      })
    }
    catch (error) {
      toast.add({ title: t('board.mode.switchFailed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
    }
    finally {
      switchingMode.value = false
    }
  }

  /** Optimistic state hop for a plain move; a failure restores the snapshot. */
  function hopTo(item: ContentItemView, state: string) {
    items.value = items.value.map(row => (row.id === item.id ? { ...row, state } : row))
  }

  /** A card already sitting in the dropped column is a no-op, not an error. */
  function isNoopDrop(item: ContentItemView, column: ContentColumnKey) {
    return columnForState(item.state) === column
  }

  /** Why the board cannot run this action yet, as a translated message. */
  function guardAction(action: ContentBoardAction): string {
    if (action === 'publish' && !publishTargets.targetId.value) return t('board.needTarget')
    return ''
  }

  /** `content.move` is a thin adapter: `to` is the state, the board decides. */
  async function postMove(item: ContentItemView, column: ContentColumnKey) {
    await $fetch('/api/v1/content/move', {
      method: 'POST',
      body: { businessId: options.businessId, itemId: item.id, to: stateForColumn(column) },
    })
  }

  /**
   * Research + article. `stopAt: 'drafting'` parks the card in Writing for the
   * human; without it the chain runs its checks and lands on Approved.
   */
  async function postWrite(item: ContentItemView, stopAt?: string) {
    await $fetch('/api/v1/content/write', {
      method: 'POST',
      body: {
        businessId: options.businessId,
        itemId: item.id,
        stopAt,
        idea: { id: item.title, title: item.title, brief: item.brief },
        platforms: item.platforms ?? [],
      },
    })
  }

  async function postPublish(item: ContentItemView) {
    const artifact = await loadArtifact(options.businessId, item.id)
    if (!artifact) throw new Error(t('board.noArtifact'))
    await approveArtifact(options.businessId, artifact)
    await $fetch('/api/v1/content/publish', {
      method: 'POST',
      body: {
        businessId: options.businessId,
        itemId: item.id,
        provider: publishTargets.provider.value,
        connectionId: publishTargets.targetId.value,
        confirm: true,
      },
    })
  }

  /** Runs one action and reports the failure instead of throwing it. */
  async function perform(item: ContentItemView, action: ContentBoardAction, column: ContentColumnKey): Promise<unknown | null> {
    try {
      if (action === 'move') await postMove(item, column)
      else if (action === 'write') await postWrite(item, 'drafting')
      else await postPublish(item)
      return null
    }
    catch (error) {
      return error
    }
  }

  function notifyOutcome(action: ContentBoardAction, failure: unknown | null) {
    const ok = failure === null
    toast.add({
      title: t(ok ? BOARD_SUCCESS_KEY[action] : BOARD_FAIL_KEY[action]),
      description: ok ? undefined : contentApiError(failure),
      icon: ok ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle',
      color: ok ? 'success' : 'error',
    })
  }

  /**
   * One board action end to end: guard, snapshot, run, then reconcile. A plain
   * move hops optimistically so the card follows the cursor; anything else
   * waits for the server. A failure restores the snapshot — never half-moved.
   */
  async function runAction(item: ContentItemView, action: ContentBoardAction, column: ContentColumnKey) {
    const blocked = guardAction(action)
    if (blocked) {
      toast.add({ title: blocked, icon: 'i-heroicons-exclamation-triangle', color: 'warning' })
      return
    }
    const snapshot = items.value.slice()
    busyId.value = item.id
    if (action === 'move') hopTo(item, stateForColumn(column))
    const failure = await perform(item, action, column)
    if (failure !== null) items.value = snapshot
    await load()
    notifyOutcome(action, failure)
    busyId.value = null
  }

  /**
   * The single drop entry point: the target column decides the action.
   *
   * An illegal target is refused here, in the browser, with a sentence the
   * owner can act on. Sending it anyway produced a raw `INVALID_TRANSITION`
   * failure toast, and — before the illegal-target check existed — the board
   * looked draggable when it was not.
   */
  async function moveTo(item: ContentItemView, column: ContentColumnKey) {
    if (locked.value || isNoopDrop(item, column)) return
    if (!canMoveTo(item, column)) {
      toast.add({ title: t('board.illegalMove', { from: t(`board.columns.${columnForState(item.state) ?? 'planned'}`), to: t(`board.columns.${column}`) }), icon: 'i-heroicons-exclamation-triangle', color: 'warning' })
      return
    }
    await runAction(item, actionForColumn(column), column)
  }

  return {
    busyId,
    columns,
    items,
    load,
    loadSafeMode,
    locked,
    loading,
    moveTo,
    safeMode,
    switchingMode,
    toggleSafeMode,
    ...publishTargets,
  }
}

// ── One idea, opened ────────────────────────────────────────────────────

export function useContentEditor(options: { businessId: string, itemId: string }) {
  const { t } = useI18n()
  const toast = useToast()
  const publishTargets = usePublishTargets(options)

  const item = ref<ContentItemView | null>(null)
  const checks = ref<ContentCheckView[]>([])
  const artifact = ref<ContentArtifactView | null>(null)
  const article = ref('')
  const safeMode = ref(true)
  const outcome = ref<PublishOutcome | null>(null)
  const loading = ref(true)
  const writing = ref(false)
  const publishing = ref(false)
  const moving = ref(false)

  const isReleased = computed(() => ['scheduled', 'published', 'archived'].includes(item.value?.state ?? ''))
  const hasDraft = computed(() => article.value.trim().length > 0)
  const canPublish = computed(() => Boolean(artifact.value) && hasDraft.value && !isReleased.value)
  const socialPosts = computed(() => platformPostsFromOutput(artifact.value?.output))
  /** One body per platform beside the article (PRD §10 D07). */
  const variants = computed(() => variantsFromOutput(artifact.value?.output))

  function applyDetail(detail: ContentItemDetail) {
    item.value = detail.item
    checks.value = detail.checks ?? []
    artifact.value = detail.artifact
    article.value = artifact.value ? articleFromOutput(artifact.value.output) : ''
  }

  function publishError(error: unknown): string {
    return contentApiErrorCode(error) === CONFIRMATION_REQUIRED
      ? t('feedback.confirmRequired')
      : contentApiError(error)
  }

  async function load() {
    loading.value = true
    try {
      applyDetail(await $fetch<ContentItemDetail>(`/api/v1/content-items/${options.itemId}`, {
        query: { businessId: options.businessId },
      }))
    }
    catch (error) {
      item.value = null
      toast.add({ title: t('feedback.detailFailed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
    }
    finally {
      loading.value = false
    }
  }

  async function loadSafeMode() {
    try {
      const response = await $fetch<{ safeMode: boolean }>(`/api/v1/business/${options.businessId}/safe-mode`)
      safeMode.value = response.safeMode
    }
    catch {
      // Fail closed: without the setting the control stays two-step.
      safeMode.value = true
    }
  }

  /**
   * Artifact output with the article swapped in — the shape
   * `PUT /api/v1/artifacts/:id/edit` wants. Every other key the writer chain
   * produced (caption, `variants`, CTA, claims, sources) round-trips untouched,
   * so saving never shrinks the artifact. A platform body is **not** saved here:
   * that route would leave `variants` stale, so it goes through
   * `content.update` instead (PRD §10 D07).
   */
  function editedOutput(articleText?: string): Record<string, unknown> {
    return { ...parseOutput(artifact.value?.output), article: articleText ?? article.value }
  }

  /**
   * The idea id the scan minted is not persisted on the item, so a re-draft
   * reuses the item's own title as the idea key — stable for this item. No
   * `stopAt` here: on the idea view the write has to finish so the article can
   * be published from this screen.
   */
  async function write() {
    if (writing.value) return
    writing.value = true
    try {
      await $fetch('/api/v1/content/write', {
        method: 'POST',
        body: {
          businessId: options.businessId,
          itemId: options.itemId,
          idea: { id: item.value?.title ?? '', title: item.value?.title ?? '', brief: item.value?.brief ?? '' },
          platforms: item.value?.platforms ?? [],
        },
      })
      await load()
      toast.add({ title: t('draft.regenerated'), icon: 'i-heroicons-check-circle', color: 'success' })
    }
    catch (error) {
      toast.add({ title: t('draft.regenerateFailed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
    }
    finally {
      writing.value = false
    }
  }

  /**
   * Release the article. The artifact is approved first — `content.publish`
   * re-checks approval on the exact version — and the response's `variant` says
   * which body went out (PRD §10 D07), which the toast names rather than hides.
   */
  async function publish() {
    if (publishing.value || !publishTargets.targetId.value || !artifact.value) return
    publishing.value = true
    try {
      await approveArtifact(options.businessId, artifact.value)
      const response = await $fetch<PublishOutcome>('/api/v1/content/publish', {
        method: 'POST',
        body: {
          businessId: options.businessId,
          itemId: options.itemId,
          provider: publishTargets.provider.value,
          connectionId: publishTargets.targetId.value,
          confirm: true,
        },
      })
      outcome.value = response
      await load()
      toast.add({
        title: t('publish.published'),
        description: t('publish.variantSent', { version: response.variant }),
        icon: 'i-heroicons-paper-airplane',
        color: 'success',
      })
    }
    catch (error) {
      outcome.value = null
      toast.add({ title: t('publish.failed'), description: publishError(error), icon: 'i-heroicons-x-circle', color: 'error' })
    }
    finally {
      publishing.value = false
    }
  }

  /** Pull a published item back to Approved; the reverse of the publish drop. */
  async function unpublish() {
    if (moving.value) return
    moving.value = true
    try {
      await $fetch('/api/v1/content/move', {
        method: 'POST',
        body: { businessId: options.businessId, itemId: options.itemId, to: 'review_required' },
      })
      await load()
      toast.add({ title: t('idea.unpublished'), icon: 'i-heroicons-arrow-uturn-left', color: 'success' })
    }
    catch (error) {
      toast.add({ title: t('idea.unpublishFailed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
    }
    finally {
      moving.value = false
    }
  }

  return {
    article,
    artifact,
    canPublish,
    checks,
    hasDraft,
    isReleased,
    item,
    loading,
    moving,
    outcome,
    publish,
    publishing,
    safeMode,
    socialPosts,
    unpublish,
    variants,
    write,
    writing,
    editedOutput,
    load,
    loadSafeMode,
    ...publishTargets,
  }
}