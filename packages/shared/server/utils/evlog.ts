import type { RequestLogger } from 'evlog'
import { withAuditMethods } from 'evlog'
import { createAILogger } from 'evlog/ai'

/**
 * Wrap a Vercel AI SDK model so token usage, tool calls and streaming
 * metrics land on the request wide event. Returns the model untouched when
 * no request logger is available (service-layer calls without an event).
 * Generic passthrough typing keeps Vercel-SDK-version friction in one place:
 * the runtime objects are this repo's `ai` v7 models, which evlog/ai wraps.
 */
export function wrapAiModel<TModel>(log: RequestLogger | undefined, model: TModel): TModel {
  if (!log) return model
  return createAILogger(log).wrap(model as never) as TModel
}

/**
 * Emits observability without ever breaking the pipeline it reports on.
 * `RequestLogger.info` takes a message plus structured fields, so an optional
 * `message` key in `fields` becomes the message and the rest stays structured.
 */
export function emitLog(log: RequestLogger | undefined, fields: Record<string, unknown>): void {
  try {
    const { message, ...context } = fields
    log?.info(typeof message === 'string' ? message : 'event', context)
  } catch {
    // observability must never break the pipeline
  }
}

/** Record an embed/embedMany call's token usage on the request wide event. */
export function captureEmbedUsage(
  log: RequestLogger | undefined,
  usage: { tokens: number, model?: string, dimensions?: number, count?: number },
): void {
  if (!log) return
  createAILogger(log).captureEmbed({
    usage: { tokens: usage.tokens },
    model: usage.model,
    dimensions: usage.dimensions,
    count: usage.count,
  })
}

export interface EvlogAuditFields {
  action: string
  actorId: string
  actorType?: 'user' | 'system' | 'api' | 'agent'
  targetType?: string
  targetId?: string
  outcome?: 'success' | 'failure' | 'denied'
  reason?: string
}

function auditTarget(fields: EvlogAuditFields): { type: string, id: string } | undefined {
  if (!fields.targetType || !fields.targetId) return undefined
  return { type: fields.targetType, id: fields.targetId }
}

/**
 * Emit an audit fact onto the request wide event. Pair with the DB auditLog
 * insert (dual-write) — the DB row stays the system of record, the wide
 * event carries the same fact to the log drains.
 */
export function auditEvent(log: RequestLogger, fields: EvlogAuditFields): void {
  withAuditMethods(log).audit({
    action: fields.action,
    actor: { type: fields.actorType ?? 'user', id: fields.actorId },
    target: auditTarget(fields),
    outcome: fields.outcome ?? 'success',
    reason: fields.reason,
  })
}
