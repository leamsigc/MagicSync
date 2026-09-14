import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { detectRegex } from '../../utils/pii'

export interface GuardAuditEntry {
  toolName: string
  blocked: boolean
  reason?: string
}

export interface GuardExtensionOptions {
  /** Server-owned allowlist; anything else is blocked defense-in-depth. */
  allowedTools: string[]
  /** When true, side-effect tools may not carry raw PII in their arguments. */
  privateMode?: boolean
  onAudit?: (entry: GuardAuditEntry) => void
}

const SIDE_EFFECT_TOOLS = new Set(['publish', 'schedule_post', 'create_post', 'download_video'])

/**
 * Server-owned tool extension: enforces the session allowlist and, in private
 * mode, blocks external side effects whose arguments carry raw personal data.
 */
export function createGuardExtension(options: GuardExtensionOptions) {
  const allowed = new Set(options.allowedTools)
  return (pi: ExtensionAPI) => {
    pi.on('tool_call', async (event) => {
      if (!allowed.has(event.toolName)) {
        options.onAudit?.({ toolName: event.toolName, blocked: true, reason: 'TOOL_NOT_ALLOWED' })
        return { block: true, reason: 'TOOL_NOT_ALLOWED: tool is not enabled for this session' }
      }
      if (options.privateMode && SIDE_EFFECT_TOOLS.has(event.toolName)) {
        const matches = detectRegex(JSON.stringify(event.input ?? {}))
        if (matches.length > 0) {
          options.onAudit?.({ toolName: event.toolName, blocked: true, reason: 'PII_BLOCKED' })
          return { block: true, reason: 'PII_BLOCKED: tool arguments contain personal data in private mode' }
        }
      }
      options.onAudit?.({ toolName: event.toolName, blocked: false })
      return undefined
    })
  }
}
