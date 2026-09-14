import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"
import { postService } from "#layers/BaseDB/server/services/post.service"
import { contentArtifactService, newDraftPostInput, resolveTargetAccountIds } from "#layers/BaseDB/server/services/content-artifact.service"
import { publishingService } from "#layers/BaseDB/server/services/publishing.service"
import { businessContextResolver, contextErrorStatus } from '#layers/BaseDB/server/services/business-context-resolver.service'
import { completeForUser } from '#layers/BaseAgent/server/utils/run-config'

const MODEL_NODE_KINDS = new Set(['agent', 'skill', 'research', 'write_post', 'humanize', 'design_fabric'])
const MATERIALIZE_KINDS = new Set(['create_carousel', 'create_reel_storyboard'])

interface SnapshotNode {
  id: string
  kind: string
  name?: string
  config?: Record<string, unknown>
}

interface RunSnapshot {
  graph: { nodes?: SnapshotNode[] }
  order?: string[]
  policy?: { useBusinessContext?: boolean }
}

function readSnapshot(run: { graphSnapshot?: string | null }): RunSnapshot | null {
  try {
    if (!run.graphSnapshot) return null
    const snapshot = JSON.parse(run.graphSnapshot) as RunSnapshot
    if (!snapshot.graph || !Array.isArray(snapshot.order)) return null
    return snapshot
  } catch {
    return null
  }
}

function priorOutputText(nodeResults: unknown): string {
  if (!Array.isArray(nodeResults)) return ''
  for (let index = nodeResults.length - 1; index >= 0; index -= 1) {
    const entry = nodeResults[index] as { status?: string, output?: unknown }
    if (entry?.status !== 'completed' || !entry.output || typeof entry.output !== 'object') continue
    const output = entry.output as Record<string, unknown>
    for (const key of ['text', 'content', 'draft']) {
      if (typeof output[key] === 'string' && (output[key] as string).trim()) {
        return (output[key] as string).trim()
      }
    }
  }
  return ''
}

function parseNodeResults(raw: string | null): unknown {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function loadExecutableNode(event: any, userId: string, runId: string) {
  const loaded = await pipelineService.getRun(runId, userId, event)
  if (!loaded.success || !loaded.data) {
    throw createError({ statusCode: 404, statusMessage: 'Pipeline run not found' })
  }
  const snapshot = readSnapshot(loaded.data)
  const node = snapshot?.graph.nodes?.find(item => item.id === loaded.data.currentNodeId)
  if (!snapshot || !node || !loaded.data.currentNodeId) {
    throw createError({ statusCode: 400, statusMessage: 'Run has no executable node' })
  }
  return { run: loaded.data, snapshot, node }
}

function guardGateNode(node: SnapshotNode): void {
  if (node.kind === 'human_review' || node.kind === 'terminal') {
    throw createError({ statusCode: 400, statusMessage: 'Review and terminal nodes are completed through their own endpoints' })
  }
}

function guardFutureAction(_node: SnapshotNode): void {
  // All first-release node kinds execute somewhere: model nodes via the
  // harness bridge, materializers via the artifact service, publish_intent
  // via publishing jobs. Unknown kinds are rejected at the dispatcher.
}

async function loadPublishTarget(event: any, userId: string, runId: string, node: SnapshotNode) {
  const artifactId = typeof node.config?.artifactId === 'string' ? node.config.artifactId : ''
  const connectionId = typeof node.config?.connectionId === 'string' ? node.config.connectionId : ''
  if (!artifactId || !connectionId) {
    throw createError({ statusCode: 400, statusMessage: `Node '${node.id}' needs artifactId and connectionId in its config` })
  }
  const run = (await pipelineService.getRun(runId, userId, event)).data
  if (!run) {
    throw createError({ statusCode: 404, statusMessage: 'Pipeline run not found' })
  }
  const artifact = await contentArtifactService.getArtifact(userId, artifactId, run.businessId, event)
  if (!artifact.success || !artifact.data) {
    throw createError({ statusCode: 404, statusMessage: 'Publish artifact not found' })
  }
  return { run, artifact: artifact.data, connectionId }
}

async function completePublishNode(event: any, userId: string, runId: string, node: SnapshotNode, output: Record<string, unknown>) {
  const completed = await pipelineService.completeNode(userId, runId, node.id, output, event)
  if (!completed.success) {
    throw createError({ statusCode: 500, statusMessage: completed.error })
  }
  return completed
}

async function executePublishIntent(event: any, userId: string, runId: string, node: SnapshotNode) {
  const target = await loadPublishTarget(event, userId, runId, node)
  const created = await publishingService.createJob(userId, {
    businessId: target.run.businessId,
    connectionId: target.connectionId,
    artifactId: target.artifact.id,
    artifactVersion: target.artifact.version,
  }, event)
  if (!created.success || !created.data) {
    throw createError({ statusCode: 400, statusMessage: created.error ?? 'Failed to create publishing job' })
  }
  if (created.data.duplicate) {
    return completePublishNode(event, userId, runId, node, { jobId: created.data.job.id, duplicate: true })
  }
  const executed = await publishingService.executeJob(userId, created.data.job.id, event)
  if (!executed.success || !executed.data) {
    throw createError({ statusCode: 502, statusMessage: executed.error ?? 'Publishing job failed' })
  }
  return completePublishNode(event, userId, runId, node, {
    jobId: executed.data.id,
    status: executed.data.status,
    remoteUrl: executed.data.remoteUrl,
  })
}

async function executeMaterializeAction(event: any, userId: string, runId: string, run: { businessId: string }, node: SnapshotNode) {
  const artifactId = typeof node.config?.artifactId === 'string' ? node.config.artifactId : ''
  if (!artifactId) {
    throw createError({ statusCode: 400, statusMessage: `Node '${node.id}' needs an artifactId in its config` })
  }
  const materialized = await contentArtifactService.materializeArtifact(userId, artifactId, run.businessId, event)
  if (!materialized.success || !materialized.data) {
    const statusCode = materialized.code === 'NOT_FOUND' ? 404 : 400
    throw createError({ statusCode, statusMessage: materialized.error ?? 'Failed to materialize artifact' })
  }
  const completed = await pipelineService.completeNode(userId, runId, node.id, {
    artifactId,
    postId: materialized.data.postId,
    duplicate: materialized.data.duplicate,
  }, event)
  if (!completed.success) {
    throw createError({ statusCode: 500, statusMessage: completed.error })
  }
  return completed
}

async function executeCreatePost(event: any, userId: string, runId: string, run: { businessId: string, nodeResults: string | null }, node: SnapshotNode) {
  const configured = typeof node.config?.content === 'string' ? node.config.content.trim() : ''
  const content = configured || priorOutputText(parseNodeResults(run.nodeResults))
  if (!content) {
    throw createError({ statusCode: 400, statusMessage: 'create_post needs node content or a prior text output' })
  }
  const targets = await resolveTargetAccountIds(run.businessId, [])
  if (!targets.success || !targets.data) {
    throw createError({ statusCode: 400, statusMessage: targets.error ?? 'No connected accounts' })
  }
  const created = await postService.create(userId, {
    ...newDraftPostInput(run.businessId, content, targets.data),
  })
  if (!created.success || !created.data) {
    throw createError({ statusCode: 500, statusMessage: created.error ?? 'Failed to materialize post' })
  }
  const completed = await pipelineService.completeNode(userId, runId, node.id, { postId: created.data.id, status: created.data.status }, event)
  if (!completed.success) {
    throw createError({ statusCode: 500, statusMessage: completed.error })
  }
  return completed
}

async function executeModelNode(
  event: any,
  userId: string,
  _userEmail: string,
  runId: string,
  run: { businessId: string, nodeResults: string | null },
  node: SnapshotNode,
  useBusinessContext: boolean,
) {
  if (!MODEL_NODE_KINDS.has(node.kind)) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported node kind '${node.kind}'` })
  }
  const brandResult = await businessContextResolver.resolve(userId, {
    businessId: run.businessId,
    useBusinessContext,
  }, event)
  if (!brandResult.success || !brandResult.data) {
    throw createError({ statusCode: contextErrorStatus(brandResult.code), message: brandResult.error })
  }
  const brand = brandResult.data
  const executedResult = await completeForUser(userId, {
    businessId: run.businessId,
    useBusinessContext: false,
    event,
    system: brand.enabled ? brand.prompt : undefined,
    maxTokens: 1600,
    prompt: [
      `Execute pipeline node "${node.name ?? node.id}" of kind ${node.kind}.`,
      `Brief: ${priorOutputText(parseNodeResults(run.nodeResults))}`,
      `Node config: ${JSON.stringify(node.config ?? {})}`,
    ].join('\n'),
  })
  if (!executedResult.success) {
    throw createError({ statusCode: 400, statusMessage: executedResult.error })
  }
  const completed = await pipelineService.completeNode(userId, runId, node.id, { text: executedResult.data.text }, event)
  if (!completed.success) {
    throw createError({ statusCode: 500, statusMessage: completed.error })
  }
  return completed
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const runId = getRouterParam(event, 'runId')
  if (!runId) throw createError({ statusCode: 400, statusMessage: 'runId is required' })

  const { run, snapshot, node } = await loadExecutableNode(event, user.id, runId)
  log.set({ runId, nodeId: node.id, kind: node.kind })
  guardGateNode(node)
  guardFutureAction(node)

  const attemptId = crypto.randomUUID()
  const checkpoint = await pipelineService.checkpointNodeStart(user.id, runId, attemptId, event)
  if (!checkpoint.success || !checkpoint.data) {
    throw createError({ statusCode: 400, statusMessage: checkpoint.error ?? 'Run is not executable' })
  }
  if (node.kind === 'manual_trigger') {
    const completed = await pipelineService.completeNode(user.id, runId, node.id, {}, event)
    if (!completed.success) {
      throw createError({ statusCode: 500, statusMessage: completed.error })
    }
    return completed
  }
  if (node.kind === 'create_post') {
    return executeCreatePost(event, user.id, runId, run, node)
  }
  if (MATERIALIZE_KINDS.has(node.kind)) {
    return executeMaterializeAction(event, user.id, runId, run, node)
  }
  if (node.kind === 'publish_intent') {
    return executePublishIntent(event, user.id, runId, node)
  }
  return executeModelNode(event, user.id, user.email || '', runId, run, node, snapshot.policy?.useBusinessContext !== false)
})
