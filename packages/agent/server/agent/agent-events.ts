// Normalized SSE contract (PRD §3.2). Every event carries a stable id derived
// from the run id + monotonic sequence so clients can dedupe/replay.
//
// T23 run/step envelope (§4.6, additive): capability runs announce themselves
// (`run.started` with the step rail), report typed step outcomes
// (`step.completed`), request human approval (`approval.required`), and close
// (`run.completed`). The chat renders one `RunCard` per run from this
// envelope and falls back to tool-call-derived steps while the pi runner
// (not yet Flue-driven) is the producer. Older clients ignore unknown types.
export interface RunStepDescriptor {
  id: string
  label: string
}

export interface RunApprovalAction {
  id: string
  label: string
}

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
  | { type: 'run.started', id: string, runId: string, capability?: string, title?: string, steps?: RunStepDescriptor[] }
  | { type: 'step.completed', id: string, runId: string, stepId: string, status: 'done' | 'failed', summary?: string, data?: unknown }
  | { type: 'approval.required', id: string, runId: string, stepId: string, actions: RunApprovalAction[] }
  | { type: 'run.completed', id: string, runId: string, result?: unknown }
  | { type: 'run.cancelled', id: string, runId: string }

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
