// Goal-level SSE contract. User-facing progress, never technical internals:
// labels come from progress.ts, event ids are stable `<goalRunId>:<seq>` so
// clients can dedupe and replay.
import type { GoalRunStatus } from './contracts'

export interface GoalPlanStepView {
  id: string
  skill: string
  label: string
  type: string
}

export type GoalStreamEvent =
  | { type: 'goal.started', id: string, goalRunId: string, goal: string }
  | { type: 'goal.plan', id: string, goalRunId: string, summary: string, steps: GoalPlanStepView[] }
  | { type: 'goal.step', id: string, goalRunId: string, stepId: string, label: string, status: 'running' | 'completed' | 'failed' | 'waiting_approval' }
  | { type: 'goal.approval_required', id: string, goalRunId: string, stepId: string, label: string, title: string }
  | { type: 'goal.completed', id: string, goalRunId: string, summary: string, result: unknown }
  | { type: 'goal.failed', id: string, goalRunId: string, status: GoalRunStatus, code?: string, message: string }

export type GoalStreamEventListener = (event: GoalStreamEvent) => void | Promise<void>

/** Plain `Omit` collapses the discriminated union, so distribute it per member. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export type GoalStreamEmitter = (event: DistributiveOmit<GoalStreamEvent, 'id'>) => void

export function createGoalEventEmitter(goalRunId: string, listener: GoalStreamEventListener): GoalStreamEmitter {
  let seq = 0
  return (event) => {
    seq += 1
    void listener({ ...event, id: `${goalRunId}:${seq}` } as GoalStreamEvent)
  }
}
