import { goalRunService } from '#layers/BaseDB/server/services/goal-run.service'
import type { CapabilityRunContext } from '../capabilities/registry'

/**
 * T12 approval gates through Flue (PRD §11): consequential capabilities
 * (publish, schedule, send, reply, delete, external mutations, spend, settings
 * changes) never execute without an explicit approval transition — from any
 * entry (route, MCP, job), because the gate lives in `runCapability`.
 *
 * Persistence reuses the existing `agent_goal_runs` transition (no new
 * table): `requestCapabilityApproval` opens a `waiting_for_approval` run
 * carrying `{ kind: 'capability-approval', capability, stepId }` in its plan;
 * the existing `POST goals/:id/approve|cancel` contracts grant or revoke it;
 * `checkCapabilityApproval` verifies the grant before every execution and the
 * `approval.required` envelope event feeds the T23 chat footer.
 */

export interface CapabilityApprovalGrant {
  goalRunId: string
  stepId: string
}

interface ApprovalPlan {
  kind: 'capability-approval'
  capability: string
  stepId: string
  summary: string
  businessId: string
}

function approvalPlanShape(record: Partial<ApprovalPlan> | null): ApprovalPlan | null {
  if (record?.kind !== 'capability-approval') return null
  if (typeof record.capability !== 'string' || typeof record.stepId !== 'string') return null
  return record as ApprovalPlan
}

function parsePlan(raw: string): ApprovalPlan | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  return approvalPlanShape(parsed as Partial<ApprovalPlan>)
}

function approvedStepsOf(raw: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const steps = parsed as Array<{ id?: unknown, status?: unknown }>
  return steps
    .filter(step => step?.status === 'approved' && typeof step?.id === 'string')
    .map(step => step.id as string)
}

/** Open an approval run for one consequential step. Never throws callers off. */
export async function requestCapabilityApproval(
  userId: string,
  businessId: string,
  capabilityId: string,
  stepId: string,
  summary: string,
): Promise<{ success: true, data: CapabilityApprovalGrant } | { success: false, error: string, code?: string }> {
  const started = await goalRunService.start(userId, { businessId, goal: summary })
  if (!started.success) return { success: false, error: started.error, code: started.code }
  const plan: ApprovalPlan = { kind: 'capability-approval', capability: capabilityId, stepId, summary, businessId }
  const planned = await goalRunService.setPlan(started.data.id, {
    plan,
    steps: [{ id: stepId, status: 'waiting_for_approval', title: summary }],
  })
  if (!planned.success) return { success: false, error: planned.error, code: planned.code }
  const waiting = await goalRunService.setStatus(started.data.id, 'waiting_for_approval')
  if (!waiting.success) return { success: false, error: waiting.error, code: waiting.code }
  return { success: true, data: { goalRunId: started.data.id, stepId } }
}

export interface CapabilityApprovalDecision {
  supported: boolean
  status?: string
  error?: string
  code?: string
}

/**
 * Grant or revoke a capability approval (called by the approve/cancel route
 * branch for `capability-approval` runs; orchestrator runs flow elsewhere).
 */
export async function decideCapabilityApproval(
  userId: string,
  goalRunId: string,
  approved: boolean,
): Promise<CapabilityApprovalDecision> {
  const loaded = await goalRunService.get(userId, goalRunId)
  if (!loaded.success) return { supported: true, status: 'failed', error: loaded.error, code: loaded.code }
  const plan = parsePlan(loaded.data.plan)
  if (!plan) return { supported: false }
  if (loaded.data.status !== 'waiting_for_approval') {
    return { supported: true, status: 'failed', error: 'Run is not waiting for approval', code: 'INVALID_STATE' }
  }
  if (!approved) {
    await goalRunService.setStatus(goalRunId, 'cancelled')
    return { supported: true, status: 'cancelled' }
  }
  await goalRunService.updateSteps(goalRunId, [{ id: plan.stepId, status: 'approved', title: plan.summary }])
  await goalRunService.setStatus(goalRunId, 'completed', { result: { approved: true, capability: plan.capability, stepId: plan.stepId } })
  return { supported: true, status: 'completed' }
}

function grantMatchesRow(planRaw: string, stepsRaw: string, capabilityId: string, stepId: string): boolean {
  const plan = parsePlan(planRaw)
  if (!plan) return false
  if (plan.capability !== capabilityId) return false
  if (plan.stepId !== stepId) return false
  return approvedStepsOf(stepsRaw).includes(stepId)
}

/** Verify a grant: same tenant, same capability, step approved. Never throws. */
export async function checkCapabilityApproval(
  ctx: Pick<CapabilityRunContext, 'userId' | 'businessId' | 'approval'>,
  capabilityId: string,
): Promise<boolean> {
  try {
    const grant = ctx.approval
    if (!grant) return false
    const loaded = await goalRunService.get(ctx.userId, grant.goalRunId)
    if (!loaded.success || loaded.data.businessId !== ctx.businessId) return false
    return grantMatchesRow(loaded.data.plan, loaded.data.steps, capabilityId, grant.stepId)
  } catch {
    return false
  }
}

/** Emit the approval footer event for the chat RunCard. Never throws. */
export async function emitApprovalRequired(
  ctx: Pick<CapabilityRunContext, 'userId' | 'businessId' | 'onEvent'>,
  capabilityId: string,
): Promise<void> {
  try {
    const requested = await requestCapabilityApproval(
      ctx.userId,
      ctx.businessId,
      capabilityId,
      capabilityId,
      `Approval required for ${capabilityId}`,
    )
    if (!requested.success) return
    ctx.onEvent?.({
      type: 'approval.required',
      runId: requested.data.goalRunId,
      stepId: requested.data.stepId,
      actions: [{ id: 'approve', label: 'Approve' }, { id: 'cancel', label: 'Cancel' }],
    })
  } catch {
    // observability must never break the pipeline
  }
}
