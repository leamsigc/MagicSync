import z from 'zod'

// Versioned Vue Flow graph contract (PRD-WORKFLOW-EDITOR §3).
// Linear workflows with durable human-review gates first; the schema
// reserves edge metadata for future use but the v1 validator rejects
// branching/parallel topologies visibly instead of silently converting them.
export const WORKFLOW_GRAPH_SCHEMA_VERSION = 1

export const WorkflowNodeKindSchema = z.enum([
  'manual_trigger',
  'agent',
  'skill',
  'research',
  'write_post',
  'humanize',
  'design_fabric',
  'human_review',
  'create_post',
  'create_carousel',
  'create_reel_storyboard',
  'publish_intent',
  'terminal',
])

export type WorkflowNodeKind = z.infer<typeof WorkflowNodeKindSchema>

export const WorkflowNodeSchema = z.object({
  id: z.string().min(1).max(120),
  kind: WorkflowNodeKindSchema,
  name: z.string().min(1).max(160),
  position: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
  agentId: z.string().max(160).nullish(),
  agentVersion: z.number().int().positive().nullish(),
  skillId: z.string().max(160).nullish(),
  skillVersion: z.number().int().positive().nullish(),
  config: z.record(z.string(), z.unknown()).default({}),
})

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1).max(120),
  source: z.string().min(1).max(120),
  target: z.string().min(1).max(120),
})

export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>

export const WorkflowPolicySchema = z.object({
  requiresArtifactApproval: z.boolean().default(true),
  maxRetriesPerNode: z.number().int().min(0).max(10).default(2),
  useBusinessContext: z.boolean().default(true),
})

export type WorkflowPolicy = z.infer<typeof WorkflowPolicySchema>

export const WorkflowGraphSchema = z.object({
  schemaVersion: z.number().default(WORKFLOW_GRAPH_SCHEMA_VERSION),
  nodes: z.array(WorkflowNodeSchema).min(1).max(100),
  edges: z.array(WorkflowEdgeSchema).max(200).default([]),
  policy: WorkflowPolicySchema.default({ requiresArtifactApproval: true, maxRetriesPerNode: 2, useBusinessContext: true }),
})

export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>

export interface GraphValidation {
  ok: boolean
  errors: string[]
  /** Deterministic trigger→terminal node order when valid. */
  order: string[]
}

const ACTION_KINDS: WorkflowNodeKind[] = [
  'create_post',
  'create_carousel',
  'create_reel_storyboard',
  'publish_intent',
]

function indexTargets(edges: WorkflowEdge[]): Map<string, string[]> {
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    const list = outgoing.get(edge.source) ?? []
    list.push(edge.target)
    outgoing.set(edge.source, list)
  }
  return outgoing
}

function indexIncoming(edges: WorkflowEdge[]): Map<string, number> {
  const incoming = new Map<string, number>()
  for (const edge of edges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)
  }
  return incoming
}

function checkEndpoints(nodes: WorkflowNode[], errors: string[]): void {
  const triggers = nodes.filter(node => node.kind === 'manual_trigger')
  if (triggers.length !== 1) errors.push('Graph must contain exactly one manual_trigger node')
  if (!nodes.some(node => node.kind === 'terminal')) errors.push('Graph must contain a terminal node')
}

function checkReferences(nodes: WorkflowNode[], edges: WorkflowEdge[], errors: string[]): void {
  const ids = new Set(nodes.map(node => node.id))
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      errors.push(`Edge '${edge.id}' references a missing node`)
    }
  }
}

function checkLinearity(nodes: WorkflowNode[], edges: WorkflowEdge[], errors: string[]): void {
  const outgoing = indexTargets(edges)
  const incoming = indexIncoming(edges)
  for (const node of nodes) {
    if ((outgoing.get(node.id) ?? []).length > 1) {
      errors.push(`Branching is not supported (node '${node.id}' has multiple outputs)`)
    }
    if (node.kind !== 'manual_trigger' && (incoming.get(node.id) ?? 0) !== 1) {
      errors.push(`Node '${node.id}' must have exactly one input`)
    }
  }
}

function walkOrder(nodes: WorkflowNode[], edges: WorkflowEdge[], errors: string[]): string[] {
  const outgoing = indexTargets(edges)
  const trigger = nodes.find(node => node.kind === 'manual_trigger')
  if (!trigger) return []
  const order: string[] = []
  const seen = new Set<string>()
  let current: string | undefined = trigger.id
  while (current && !seen.has(current)) {
    seen.add(current)
    order.push(current)
    current = (outgoing.get(current) ?? [])[0]
  }
  if (current) errors.push('Graph contains a cycle')
  if (order.length !== nodes.length) errors.push('Graph has disconnected nodes')
  return order
}

function checkReviewGate(nodes: WorkflowNode[], order: string[], errors: string[]): void {
  const kinds = new Map(nodes.map(node => [node.id, node.kind]))
  const reviewIndex = order.findIndex(id => kinds.get(id) === 'human_review')
  const firstAction = order.findIndex(id => kinds.get(id) && ACTION_KINDS.includes(kinds.get(id) as WorkflowNodeKind))
  if (firstAction !== -1 && reviewIndex === -1) {
    errors.push('Action nodes require a human_review gate before them')
  }
  if (reviewIndex !== -1 && firstAction !== -1 && reviewIndex > firstAction) {
    errors.push('The human_review gate must come before action nodes')
  }
}

/**
 * Validate a workflow graph before save/activation/run (PRD §4).
 * Pure and deterministic: no database access.
 */
export function validateWorkflowGraph(graph: unknown): GraphValidation {
  const parsed = WorkflowGraphSchema.safeParse(graph)
  if (!parsed.success) {
    return { ok: false, errors: ['Graph does not match the versioned schema'], order: [] }
  }
  const errors: string[] = []
  const { nodes, edges } = parsed.data
  checkEndpoints(nodes, errors)
  checkReferences(nodes, edges, errors)
  checkLinearity(nodes, edges, errors)
  const order = walkOrder(nodes, edges, errors)
  if (order.length > 0) checkReviewGate(nodes, order, errors)
  return { ok: errors.length === 0, errors, order: errors.length === 0 ? order : [] }
}

/**
 * Linearize a validated graph into execution order. Returns null unless valid.
 */
export function linearizeGraph(graph: WorkflowGraph): WorkflowNode[] | null {
  const validation = validateWorkflowGraph(graph)
  if (!validation.ok) return null
  const byId = new Map(graph.nodes.map(node => [node.id, node]))
  return validation.order.map(id => byId.get(id)).filter((node): node is WorkflowNode => !!node)
}
