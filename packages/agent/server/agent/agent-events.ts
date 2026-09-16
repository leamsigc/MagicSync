// Normalized SSE contract (PRD §3.2). Every event carries a stable id derived
// from the run id + monotonic sequence so clients can dedupe/replay.
export type AgentStreamEvent =
  | { type: 'message.started', id: string, sessionId: string }
  | { type: 'thinking.delta', id: string, delta: string }
  | { type: 'text.delta', id: string, delta: string }
  | { type: 'tool.started', id: string, toolCallId: string, toolName: string, args: unknown }
  | { type: 'tool.progress', id: string, toolCallId: string, toolName: string, partial: unknown }
  | { type: 'tool.finished', id: string, toolCallId: string, toolName: string, isError: boolean, result: unknown }
  | { type: 'artifact.created', id: string, artifactId: string }
  | { type: 'review.required', id: string, artifactId: string }
  | { type: 'message.completed', id: string, sessionId: string, threadId: string, content: string }
  | { type: 'error', id: string, code: string, message: string }

export type AgentStreamEventListener = (event: AgentStreamEvent) => void | Promise<void>

/** Plain `Omit` collapses the discriminated union, so distribute it per member. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export type AgentStreamEmitter = (event: DistributiveOmit<AgentStreamEvent, 'id'>) => void | Promise<void>

export function createEventEmitter(runId: string, listener: AgentStreamEventListener): AgentStreamEmitter {
  let seq = 0
  return (event) => {
    seq += 1
    return listener({ ...event, id: `${runId}:${seq}` } as AgentStreamEvent)
  }
}
