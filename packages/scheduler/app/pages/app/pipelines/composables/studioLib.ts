import type { PipelineStep } from '#layers/BaseDB/db/schema'

/**
 * Pipeline studio graph library: node catalog, validation and
 * linearization helpers shared by studio.vue and its tests.
 *
 * Phase nodes execute in flow order via the existing stepwise run.
 * Trigger is the start anchor (never saved as a step). Action nodes
 * are post-run shortcuts stored on the pipeline and surfaced as
 * buttons — they are not sent as phases.
 */

export type StudioNodeCategory = 'triggers' | 'phases' | 'actions'

export interface StudioNodeDef {
  kind: string
  category: StudioNodeCategory
  labelKey: string
  defaultName: string
  icon: string
  phaseType: string | null
  defaultPrompt: string
  defaultConfig: Record<string, unknown>
  hasInput: boolean
  hasOutput: boolean
}

export interface StudioGraphNode {
  id: string
  kind: string
  name: string
  prompt: string
  config: Record<string, unknown>
  position: { x: number, y: number }
}

export interface StudioGraphEdge {
  id: string
  source: string
  target: string
}

export type StudioValidationReason = 'noTrigger' | 'multiTrigger' | 'cycle' | 'actionNotAtEnd' | null

export interface StudioValidation {
  ok: boolean
  reason: StudioValidationReason
  badIds: string[]
}

export const NODE_CATALOG: StudioNodeDef[] = [
  { kind: 'trigger-manual', category: 'triggers', labelKey: 'nodes.triggerManual', defaultName: 'Manual trigger', icon: 'i-heroicons-bolt', phaseType: null, defaultPrompt: '', defaultConfig: {}, hasInput: false, hasOutput: true },
  { kind: 'research', category: 'phases', labelKey: 'nodes.research', defaultName: 'Research topics', icon: 'i-heroicons-magnifying-glass', phaseType: 'llm_agent', defaultPrompt: 'You are a social media research agent. Given the user brief, business context, and any reference documents, return the best topics with angles, hooks, and source notes as JSON.', defaultConfig: {}, hasInput: true, hasOutput: true },
  { kind: 'writer', category: 'phases', labelKey: 'nodes.writer', defaultName: 'Write post', icon: 'i-heroicons-pencil-square', phaseType: 'llm_single', defaultPrompt: 'You are a social media content writer. Use the research output and business context to write the post caption and slide copy.', defaultConfig: { schema: 'social_post' }, hasInput: true, hasOutput: true },
  { kind: 'humanizer', category: 'phases', labelKey: 'nodes.humanizer', defaultName: 'Humanize', icon: 'i-heroicons-face-smile', phaseType: 'llm_single', defaultPrompt: 'You are a human behavior and sentiment editor. Rewrite the draft to sound human and emotional without changing facts or structure.', defaultConfig: {}, hasInput: true, hasOutput: true },
  { kind: 'design', category: 'phases', labelKey: 'nodes.design', defaultName: 'Design HTML', icon: 'i-heroicons-photo', phaseType: 'llm_single', defaultPrompt: 'You are a social design agent. Output HTML only for the post image, carousel slides, or hero thumbnail, referencing the provided asset/template slots. No explanations.', defaultConfig: { schema: 'social_design' }, hasInput: true, hasOutput: true },
  { kind: 'virality', category: 'phases', labelKey: 'nodes.virality', defaultName: 'Virality check', icon: 'i-heroicons-fire', phaseType: 'llm_single', defaultPrompt: 'You are a virality analyst. Score the draft hooks and angles for shareability and list the top 3 improvements without changing facts.', defaultConfig: {}, hasInput: true, hasOutput: true },
  { kind: 'engagement', category: 'phases', labelKey: 'nodes.engagement', defaultName: 'Engagement plan', icon: 'i-heroicons-chat-bubble-left-right', phaseType: 'llm_single', defaultPrompt: 'You are an engagement strategist. Given the draft and business context, propose calls to action, reply prompts, and posting-time notes as JSON.', defaultConfig: {}, hasInput: true, hasOutput: true },
  { kind: 'scrape', category: 'phases', labelKey: 'nodes.scrape', defaultName: 'Scrape sources', icon: 'i-heroicons-globe-alt', phaseType: 'llm_single', defaultPrompt: 'You are a content researcher. Given the brief, list the sources to consult and the facts to extract as JSON.', defaultConfig: {}, hasInput: true, hasOutput: true },
  { kind: 'template', category: 'phases', labelKey: 'nodes.template', defaultName: 'Pick template', icon: 'i-heroicons-squares-2x2', phaseType: 'llm_single', defaultPrompt: 'You are a template picker. Given the draft and the available asset templates, choose the best slots and output the mapping as JSON.', defaultConfig: {}, hasInput: true, hasOutput: true },
  { kind: 'custom', category: 'phases', labelKey: 'nodes.custom', defaultName: 'Custom prompt', icon: 'i-heroicons-sparkles', phaseType: 'llm_single', defaultPrompt: 'You are a helpful assistant. Transform the input as instructed and return the result.', defaultConfig: {}, hasInput: true, hasOutput: true },
  { kind: 'human-review', category: 'phases', labelKey: 'nodes.humanReview', defaultName: 'Human review', icon: 'i-heroicons-eye', phaseType: 'llm_human_input', defaultPrompt: 'Review the generated post and design. Approve to finish or request changes with feedback.', defaultConfig: {}, hasInput: true, hasOutput: true },
  { kind: 'create-post', category: 'actions', labelKey: 'nodes.createPost', defaultName: 'Create post', icon: 'i-heroicons-plus-circle', phaseType: null, defaultPrompt: '', defaultConfig: { href: '/app/posts/new' }, hasInput: true, hasOutput: false },
  { kind: 'push-publish', category: 'actions', labelKey: 'nodes.pushPublish', defaultName: 'Push to publish', icon: 'i-heroicons-paper-airplane', phaseType: null, defaultPrompt: '', defaultConfig: { href: '/app/calendar' }, hasInput: true, hasOutput: false },
  { kind: 'open-tts', category: 'actions', labelKey: 'nodes.openTts', defaultName: 'Open voiceover', icon: 'i-heroicons-speaker-wave', phaseType: null, defaultPrompt: '', defaultConfig: { href: '/app/tools/text-to-speech' }, hasInput: true, hasOutput: false },
  { kind: 'quick-batch', category: 'actions', labelKey: 'nodes.quickBatch', defaultName: 'Quick batch', icon: 'i-heroicons-queue-list', phaseType: null, defaultPrompt: '', defaultConfig: {}, hasInput: true, hasOutput: false }
]

export const NODE_CATEGORIES: Array<{ id: StudioNodeCategory, kinds: string[] }> = [
  { id: 'triggers', kinds: ['trigger-manual'] },
  { id: 'phases', kinds: ['research', 'writer', 'humanizer', 'design', 'virality', 'engagement', 'scrape', 'template', 'custom', 'human-review'] },
  { id: 'actions', kinds: ['create-post', 'push-publish', 'open-tts', 'quick-batch'] }
]

const LEGACY_KIND_BY_ID: Record<string, string> = {
  research: 'research',
  writer: 'writer',
  humanizer: 'humanizer',
  design: 'design',
  review: 'human-review'
}

export function nodeDefOf(kind: string): StudioNodeDef {
  const found = NODE_CATALOG.find(def => def.kind === kind)
  return found ?? NODE_CATALOG[9]
}

export function isTriggerKind(kind: string): boolean {
  return kind === 'trigger-manual'
}

export function isActionKind(kind: string): boolean {
  return nodeDefOf(kind).category === 'actions'
}

export function isPhaseKind(kind: string): boolean {
  return nodeDefOf(kind).category === 'phases'
}

export function adjacencyOf(nodes: Array<{ id: string }>, edges: StudioGraphEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>(nodes.map(node => [node.id, [] as string[]]))
  for (const edge of edges) {
    const targets = adj.get(edge.source)
    if (targets && adj.has(edge.target)) {
      targets.push(edge.target)
    }
  }
  return adj
}

function visitNode(id: string, adj: Map<string, string[]>, color: Map<string, number>, trail: string[]): string[] {
  color.set(id, 1)
  trail.push(id)
  for (const next of adj.get(id) ?? []) {
    const state = color.get(next) ?? 0
    if (state === 1) {
      return trail.slice(trail.indexOf(next))
    }
    if (state === 0) {
      const found = visitNode(next, adj, color, trail)
      if (found.length > 0) {
        return found
      }
    }
  }
  color.set(id, 2)
  trail.pop()
  return []
}

export function findCycle(nodes: Array<{ id: string }>, edges: StudioGraphEdge[]): string[] {
  const adj = adjacencyOf(nodes, edges)
  const color = new Map<string, number>()
  for (const node of nodes) {
    if ((color.get(node.id) ?? 0) !== 0) {
      continue
    }
    const found = visitNode(node.id, adj, color, [])
    if (found.length > 0) {
      return found
    }
  }
  return []
}

export function actionEndViolations(nodes: StudioGraphNode[], edges: StudioGraphEdge[]): string[] {
  const sources = new Set(edges.map(edge => edge.source))
  return nodes
    .filter(node => isActionKind(node.kind) && sources.has(node.id))
    .map(node => node.id)
}

function invalidGraph(reason: Exclude<StudioValidationReason, null>, badIds: string[]): StudioValidation {
  return { ok: false, reason, badIds }
}

export function validateGraph(nodes: StudioGraphNode[], edges: StudioGraphEdge[]): StudioValidation {
  const triggers = nodes.filter(node => isTriggerKind(node.kind))
  if (triggers.length === 0) {
    return invalidGraph('noTrigger', [])
  }
  if (triggers.length > 1) {
    return invalidGraph('multiTrigger', triggers.map(node => node.id))
  }
  const cycle = findCycle(nodes, edges)
  if (cycle.length > 0) {
    return invalidGraph('cycle', cycle)
  }
  const badActions = actionEndViolations(nodes, edges)
  if (badActions.length > 0) {
    return invalidGraph('actionNotAtEnd', badActions)
  }
  return { ok: true, reason: null, badIds: [] }
}

function nextUnvisited(adj: Map<string, string[]>, id: string, seen: Set<string>): string | undefined {
  return (adj.get(id) ?? []).find(target => !seen.has(target))
}

export function linearize(nodes: Array<{ id: string, kind: string }>, edges: StudioGraphEdge[]): string[] {
  const adj = adjacencyOf(nodes, edges)
  const trigger = nodes.find(node => isTriggerKind(node.kind))
  const order: string[] = []
  const seen = new Set<string>()
  let current: string | undefined = trigger ? trigger.id : nodes[0]?.id
  while (current && !seen.has(current)) {
    seen.add(current)
    order.push(current)
    current = nextUnvisited(adj, current, seen)
  }
  for (const node of nodes) {
    if (!seen.has(node.id)) {
      order.push(node.id)
    }
  }
  return order
}

export type StudioConnectionError = 'self' | 'unknown' | 'port' | 'duplicate' | null

export function connectionError(source: string, target: string, nodes: StudioGraphNode[], edges: StudioGraphEdge[]): StudioConnectionError {
  if (source === target) {
    return 'self'
  }
  const src = nodes.find(node => node.id === source)
  const dst = nodes.find(node => node.id === target)
  if (!src || !dst) {
    return 'unknown'
  }
  if (!nodeDefOf(src.kind).hasOutput || !nodeDefOf(dst.kind).hasInput) {
    return 'port'
  }
  if (edges.some(edge => edge.source === source && edge.target === target)) {
    return 'duplicate'
  }
  return null
}

export function buildSteps(nodes: StudioGraphNode[], edges: StudioGraphEdge[], order: string[]): PipelineStep[] {
  const adj = adjacencyOf(nodes, edges)
  const byId = new Map(nodes.map(node => [node.id, node]))
  const steps: PipelineStep[] = []
  for (const id of order) {
    const node = byId.get(id)
    if (!node || isTriggerKind(node.kind)) {
      continue
    }
    steps.push({
      id: node.id,
      name: node.name,
      type: nodeDefOf(node.kind).phaseType ?? 'action',
      prompt: node.prompt,
      kind: node.kind,
      position: node.position,
      config: node.config,
      next: adj.get(id) ?? []
    })
  }
  return steps
}

export function fallbackPosition(index: number): { x: number, y: number } {
  return { x: 60 + (index % 4) * 240, y: 80 + Math.floor(index / 4) * 150 }
}

function kindFromStep(step: PipelineStep): string {
  if (step.kind) {
    return step.kind
  }
  const legacy = LEGACY_KIND_BY_ID[step.id]
  if (legacy) {
    return legacy
  }
  if (step.type === 'llm_agent') {
    return 'research'
  }
  if (step.type === 'llm_human_input') {
    return 'human-review'
  }
  return 'custom'
}

function edgesFromSteps(steps: PipelineStep[]): StudioGraphEdge[] {
  const ids = new Set(steps.map(step => step.id))
  const edges: StudioGraphEdge[] = []
  for (const step of steps) {
    for (const target of step.next ?? []) {
      if (ids.has(target)) {
        edges.push({ id: `e_${step.id}_${target}`, source: step.id, target })
      }
    }
  }
  return edges
}

function chainSteps(steps: PipelineStep[]): StudioGraphEdge[] {
  const edges: StudioGraphEdge[] = []
  for (let index = 0; index < steps.length - 1; index += 1) {
    const source = steps[index].id
    const target = steps[index + 1].id
    edges.push({ id: `e_${source}_${target}`, source, target })
  }
  return edges
}

export function parseStepsToGraph(steps: PipelineStep[]): { nodes: StudioGraphNode[], edges: StudioGraphEdge[] } {
  const nodes = steps.map((step, index) => ({
    id: step.id,
    kind: kindFromStep(step),
    name: step.name,
    prompt: step.prompt ?? '',
    config: step.config ?? {},
    position: step.position ?? fallbackPosition(index)
  }))
  const linked = edgesFromSteps(steps)
  const edges = linked.length === 0 && steps.length > 1 ? chainSteps(steps) : linked
  return { nodes, edges }
}
