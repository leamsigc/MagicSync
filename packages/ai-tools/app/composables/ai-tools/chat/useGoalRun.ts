import { ref, type Ref } from 'vue'

export type GoalStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting_approval'
export type GoalRunStatus = 'idle' | 'running' | 'waiting_for_approval' | 'completed' | 'failed' | 'cancelled'

export interface GoalPlanStep {
  id: string
  skill: string
  label: string
  type: string
  status: GoalStepStatus
}

export interface GoalWaiting {
  stepId: string
  label: string
  title: string
}

interface GoalOutcome {
  goalRunId: string
  status: string
  summary?: string
  stepId?: string
  title?: string
  label?: string
  error?: string
  code?: string
  result?: unknown
}

interface GoalSnapshot {
  id: string
  goal: string
  status: string
  plan: unknown
  steps: unknown
  result: unknown
  error?: string | null
}

interface GoalStreamEvent {
  type: string
  goalRunId?: string
  summary?: string
  steps?: Array<{ id: string, skill: string, label: string, type: string }>
  stepId?: string
  label?: string
  title?: string
  status?: string
  code?: string
  message?: string
  result?: unknown
  outcome?: GoalOutcome
}

interface GoalEventContext {
  runId: Ref<string | null>
  status: Ref<GoalRunStatus>
  summary: Ref<string>
  steps: Ref<GoalPlanStep[]>
  waiting: Ref<GoalWaiting | null>
  error: Ref<string>
  applyOutcome: (outcome: GoalOutcome) => void
}

function markStepRunning(steps: Ref<GoalPlanStep[]>, event: GoalStreamEvent): void {
  const step = steps.value.find(entry => entry.id === event.stepId)
  if (step && event.status) step.status = event.status as GoalStepStatus
}

const GOAL_EVENT_HANDLERS: Record<string, (event: GoalStreamEvent, ctx: GoalEventContext) => void> = {
  'goal.started': (event, ctx) => {
    if (event.goalRunId) ctx.runId.value = event.goalRunId
    ctx.status.value = 'running'
  },
  'goal.plan': (event, ctx) => {
    ctx.summary.value = event.summary ?? ''
    ctx.steps.value = (event.steps ?? []).map(step => ({ ...step, status: 'pending' as GoalStepStatus }))
  },
  'goal.step': (event, ctx) => markStepRunning(ctx.steps, event),
  'goal.approval_required': (event, ctx) => {
    ctx.status.value = 'waiting_for_approval'
    ctx.waiting.value = { stepId: event.stepId ?? '', label: event.label ?? '', title: event.title ?? '' }
  },
  'goal.completed': (event, ctx) => {
    ctx.status.value = 'completed'
    if (event.summary) ctx.summary.value = event.summary
    ctx.waiting.value = null
  },
  'goal.failed': (event, ctx) => {
    ctx.status.value = 'failed'
    ctx.error.value = event.message ?? 'Goal failed'
  },
  'goal.done': (event, ctx) => {
    if (event.outcome) ctx.applyOutcome(event.outcome)
  },
}

function parseGoalEvent(json: string): GoalStreamEvent | null {
  try {
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null) return null
    if (typeof (parsed as { type?: unknown }).type !== 'string') return null
    return parsed as GoalStreamEvent
  }
  catch {
    return null
  }
}

function handleGoalLine(line: string, ctx: GoalEventContext): void {
  if (!line.startsWith('data: ')) return
  const event = parseGoalEvent(line.slice(6).trim())
  if (!event) return
  GOAL_EVENT_HANDLERS[event.type]?.(event, ctx)
}

function dispatchGoalLines(buffer: string, ctx: GoalEventContext): string {
  let rest = buffer
  let newlineIndex = rest.indexOf('\n')
  while (newlineIndex !== -1) {
    handleGoalLine(rest.slice(0, newlineIndex), ctx)
    rest = rest.slice(newlineIndex + 1)
    newlineIndex = rest.indexOf('\n')
  }
  return rest
}

async function consumeGoalStream(body: ReadableStream<Uint8Array>, ctx: GoalEventContext): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    buffer = dispatchGoalLines(buffer, ctx)
  }
}

async function readGoalError(response: Response): Promise<string> {
  try {
    const data = await response.json() as { message?: unknown, statusMessage?: unknown }
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.statusMessage === 'string' && data.statusMessage) return data.statusMessage
  }
  catch {
    // Fall through to the status fallback below
  }
  return `HTTP error: ${response.status}`
}

function asPlanSteps(plan: unknown): Array<{ id: string, skill: string, label: string, type: string }> {
  const steps = (plan as { steps?: unknown } | null)?.steps
  if (!Array.isArray(steps)) return []
  return steps.filter((step): step is { id: string, skill: string, label: string, type: string } => (
    typeof step === 'object' && step !== null
    && typeof (step as { id?: unknown }).id === 'string'
  )).map(step => ({ id: step.id, skill: step.skill, label: step.label, type: step.type }))
}

function asStepStates(steps: unknown): Array<{ id: string, status: GoalStepStatus }> {
  if (!Array.isArray(steps)) return []
  return steps.filter((step): step is { id: string, status: GoalStepStatus } => (
    typeof step === 'object' && step !== null
    && typeof (step as { id?: unknown }).id === 'string'
  )).map(step => ({ id: step.id, status: step.status }))
}

function mapRunStatus(status: string): GoalRunStatus {
  if (status === 'waiting_for_approval' || status === 'completed' || status === 'failed' || status === 'cancelled') return status
  return 'running'
}

export function useGoalRun() {
  const { t } = useI18n()
  const toast = useToast()

  const runId = ref<string | null>(null)
  const goal = ref('')
  const status = ref<GoalRunStatus>('idle')
  const summary = ref('')
  const steps = ref<GoalPlanStep[]>([])
  const waiting = ref<GoalWaiting | null>(null)
  const error = ref('')
  const busy = ref(false)

  function resetState(goalText: string): void {
    goal.value = goalText
    status.value = 'idle'
    summary.value = ''
    steps.value = []
    waiting.value = null
    error.value = ''
  }

  function resetGoal(): void {
    runId.value = null
    resetState('')
  }

  function applyOutcome(outcome: GoalOutcome): void {
    runId.value = outcome.goalRunId || runId.value
    if (outcome.status === 'completed') {
      status.value = 'completed'
      summary.value = outcome.summary ?? ''
      waiting.value = null
    }
    else if (outcome.status === 'waiting_for_approval') {
      status.value = 'waiting_for_approval'
      waiting.value = { stepId: outcome.stepId ?? '', label: outcome.label ?? '', title: outcome.title ?? '' }
    }
    else if (outcome.status === 'failed') {
      status.value = 'failed'
      error.value = outcome.error ?? 'Goal failed'
    }
    else if (outcome.status === 'cancelled') {
      status.value = 'cancelled'
      waiting.value = null
    }
  }

  function applySnapshot(snapshot: GoalSnapshot): void {
    runId.value = snapshot.id
    goal.value = snapshot.goal
    const states = new Map(asStepStates(snapshot.steps).map(state => [state.id, state.status]))
    steps.value = asPlanSteps(snapshot.plan).map(step => ({
      ...step,
      status: states.get(step.id) ?? 'pending',
    }))
    status.value = mapRunStatus(snapshot.status)
    if (typeof snapshot.error === 'string') error.value = snapshot.error
  }

  function eventContext(): GoalEventContext {
    return { runId, status, summary, steps, waiting, error, applyOutcome }
  }

  function notifyStartError(error: unknown): void {
    status.value = 'failed'
    error.value = error instanceof Error ? error.message : String(error)
    toast.add({
      title: t('error'),
      description: error.value.split('\n')[0] ?? error.value,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }

  async function startGoal(businessId: string, goalText: string): Promise<void> {
    if (!goalText.trim() || busy.value) return
    busy.value = true
    resetState(goalText)
    try {
      const response = await fetch('/api/v1/agent/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, goal: goalText }),
      })
      if (!response.ok) throw new Error(await readGoalError(response))
      if (!response.body) throw new Error('No response body')
      status.value = 'running'
      await consumeGoalStream(response.body, eventContext())
    }
    catch (error: unknown) {
      notifyStartError(error)
    }
    finally {
      busy.value = false
    }
  }

  async function respondToApproval(approved: boolean): Promise<void> {
    const id = runId.value
    if (!id || busy.value) return
    busy.value = true
    try {
      const outcome = await $fetch<GoalOutcome>(`/api/v1/agent/goals/${id}/approve`, {
        method: 'POST',
        body: { approved },
      })
      applyOutcome(outcome)
      if (outcome.status === 'failed') {
        toast.add({ title: t('error'), description: outcome.error, icon: 'i-heroicons-x-circle', color: 'error' })
      }
    }
    catch (error: unknown) {
      toast.add({
        title: t('error'),
        description: error instanceof Error ? error.message : undefined,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
    finally {
      busy.value = false
    }
  }

  async function cancelGoal(): Promise<void> {
    const id = runId.value
    if (!id || busy.value) return
    busy.value = true
    try {
      const outcome = await $fetch<GoalOutcome>(`/api/v1/agent/goals/${id}/cancel`, { method: 'POST' })
      applyOutcome(outcome)
    }
    catch (error: unknown) {
      toast.add({
        title: t('error'),
        description: error instanceof Error ? error.message : undefined,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
    finally {
      busy.value = false
    }
  }

  async function refreshGoal(): Promise<void> {
    const id = runId.value
    if (!id || busy.value) return
    busy.value = true
    try {
      const snapshot = await $fetch<GoalSnapshot>(`/api/v1/agent/goals/${id}`)
      applySnapshot(snapshot)
    }
    catch (error: unknown) {
      toast.add({
        title: t('error'),
        description: error instanceof Error ? error.message : undefined,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
    finally {
      busy.value = false
    }
  }

  return {
    runId,
    goal,
    status,
    summary,
    steps,
    waiting,
    error,
    busy,
    startGoal,
    respondToApproval,
    cancelGoal,
    refreshGoal,
    resetGoal,
  }
}
