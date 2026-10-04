import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { agentSessionService } from '#layers/BaseAgent/server/services/agent-session.service'

interface SessionToolCall {
  id?: string
  name?: string
  args?: Record<string, unknown>
}

interface SessionToolMessage {
  toolCalls?: SessionToolCall[]
  toolCallId?: string
  toolName?: string
  args?: Record<string, unknown>
  result?: unknown
  isError?: boolean
}

interface SessionRow {
  type?: string
  message?: SessionToolMessage
}

function asSessionRow(raw: unknown): SessionRow | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as SessionRow
}

function registerDeclaredCalls(map: Map<string, { id: string, name: string, args: Record<string, unknown>, result?: string, error?: string }>, msg: SessionToolMessage): void {
  if (!Array.isArray(msg.toolCalls)) return
  for (const tc of msg.toolCalls) {
    if (tc.id) map.set(tc.id, { id: tc.id, name: tc.name || 'unknown', args: tc.args || {} })
  }
}

function resultToText(result: unknown): string {
  if (typeof result === 'string') return result
  if (!result || typeof result !== 'object') return ''
  const content = (result as { content?: Array<{ type?: string, text?: string }> }).content
  if (Array.isArray(content)) {
    return content.filter(block => block.type === 'text').map(block => block.text || '').join('\n')
  }
  try {
    return JSON.stringify(result)
  } catch {
    return String(result)
  }
}

function registerFinishedCall(map: Map<string, { id: string, name: string, args: Record<string, unknown>, result?: string, error?: string }>, msg: SessionToolMessage): void {
  const toolCallId = msg.toolCallId
  const toolName = msg.toolName
  if (!toolCallId || !toolName) return
  const existing = map.get(toolCallId) || { id: toolCallId, name: toolName, args: msg.args || {} }
  const text = resultToText(msg.result)
  existing.result = text
  if (msg.isError) existing.error = text
  map.set(toolCallId, existing)
}

function extractToolCallsFromEntries(entries: Array<{ entry: unknown }>): Map<string, { id: string, name: string, args: Record<string, unknown>, result?: string, error?: string }> {
  const map = new Map<string, { id: string, name: string, args: Record<string, unknown>, result?: string, error?: string }>()
  for (const row of entries) {
    const entry = asSessionRow(row.entry)
    if (!entry || typeof entry.message !== 'object' || !entry.message) continue
    registerDeclaredCalls(map, entry.message)
    registerFinishedCall(map, entry.message)
  }
  return map
}

function isToolCallShape(value: unknown): boolean {
  return !!value && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string'
}

function hasValidToolCalls(metadata: unknown): boolean {
  const parsed = typeof metadata === 'string' ? parseMessageMeta(metadata) : null
  if (!parsed) return false
  const calls = parsed.toolCalls
  if (!Array.isArray(calls) || calls.length === 0) return false
  return isToolCallShape(calls[0])
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function safeJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isPlainObject(parsed)) return parsed
    return null
  } catch {
    return null
  }
}

function parseMessageMeta(metadata: unknown): Record<string, unknown> | null {
  if (typeof metadata !== 'string') return null
  return safeJsonObject(metadata)
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const threadId = getRouterParam(event, 'id')

  log.set({ threadId })

  if (!threadId) {
    throw createError({ statusCode: 400, statusMessage: 'Thread ID required' })
  }

  const result = await aiToolsFacade.getMessages(threadId, user.id)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  const messages = result.data || []

  // Enrich older messages that have no toolCalls array (saved as count) from agent session entries
  const needsEnrichment = messages.some(msg => msg.role === 'assistant' && !hasValidToolCalls(msg.metadata))

  if (needsEnrichment) {
    try {
      const sessionRes = await agentSessionService.getByThread(user.id, threadId)
      if (sessionRes.success && sessionRes.data) {
        const entriesRes = await agentSessionService.loadEntries(user.id, sessionRes.data.id)
        if (entriesRes.success && entriesRes.data?.length) {
          const toolMap = extractToolCallsFromEntries(entriesRes.data as Array<{ entry: unknown }>)
          if (toolMap.size > 0) {
            for (const msg of messages) {
              if (msg.role !== 'assistant' || !msg.metadata || hasValidToolCalls(msg.metadata)) continue
              const meta = parseMessageMeta(msg.metadata) ?? {}
              const reconstructed = Array.from(toolMap.values())
              if (reconstructed.length > 0) {
                msg.metadata = JSON.stringify({ ...meta, toolCalls: reconstructed, toolCallsCount: reconstructed.length })
              }
            }
          }
        }
      }
    } catch (e) {
      log.warn('Failed to enrich toolCalls from agent entries', { error: String(e) })
    }
  }

  return messages
})
