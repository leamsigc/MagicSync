import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  awaitingArtifacts,
  buildActivity,
  errorText,
  unwrapList,
  type AwaitingApproval,
  type OperatorActivityItem,
  type OperatorApprovalRecordRow,
  type OperatorArtifactRow,
  type OperatorRunRow,
} from './operatorConsoleData'

/**
 * The operator console's data layer (PRD-CONTENT-PIPELINE-OVERHAUL §1.3): the
 * approvals queue, the activity feed and the safe-mode setting, each scoped to
 * the active business. Three factories, one shared fetcher shape, so the three
 * rail regions can own their own refresh without the page owning their state.
 */

export type ApprovalDecision = 'approved' | 'rejected'

const CLOCK_INTERVAL_MS = 60_000

function failureToast(toast: ReturnType<typeof useToast>, title: string, error: unknown): void {
  toast.add({
    title,
    description: errorText(error),
    icon: 'i-heroicons-x-circle',
    color: 'error',
  })
}

/** A minute tick so "just now" becomes "3 min ago" without a reload. */
export function useOperatorClock() {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    timer = setInterval(() => {
      now.value = Date.now()
    }, CLOCK_INTERVAL_MS)
  })

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
  })

  return now
}

export function useOperatorApprovals(getBusinessId: () => string | undefined) {
  const toast = useToast()
  const { t } = useI18n()

  /**
   * Shared state, so the approvals rail and the chat header's badge read one
   * list from one fetch. As plain refs each caller fetched its own copy and the
   * badge would have been a second request for data the rail already had.
   */
  const items = useState<AwaitingApproval[]>('operator:approvals', () => [])
  const loading = useState<boolean>('operator:approvals:loading', () => false)
  const pendingId = useState<string | null>('operator:approvals:pending', () => null)
  const pendingDecision = useState<ApprovalDecision | null>('operator:approvals:decision', () => null)

  async function load(): Promise<void> {
    const businessId = getBusinessId()
    if (!businessId) {
      items.value = []
      return
    }
    loading.value = true
    try {
      const [artifactResponse, approvalResponse] = await Promise.all([
        $fetch('/api/v1/artifacts', { query: { businessId } }),
        $fetch('/api/v1/artifacts/approvals', { query: { businessId } }),
      ])
      items.value = awaitingArtifacts(
        unwrapList<OperatorArtifactRow>(artifactResponse),
        unwrapList<OperatorApprovalRecordRow>(approvalResponse),
      )
    }
    catch (error: unknown) {
      items.value = []
      log.error({ message: 'operator approvals failed to load', error: String(error) })
      failureToast(toast, t('operator.approvalsFailed'), error)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * The decision goes through the artifact review route; it is the server that
   * re-checks the version and the status before it counts.
   */
  async function decide(item: AwaitingApproval, decision: ApprovalDecision): Promise<void> {
    const businessId = getBusinessId()
    if (!businessId || pendingId.value) return
    pendingId.value = item.id
    pendingDecision.value = decision
    try {
      await $fetch(`/api/v1/artifacts/${item.id}/review`, {
        method: 'POST',
        query: { businessId },
        body: { decision, version: item.version, feedback: '' },
      })
      toast.add({
        title: t(decision === 'approved' ? 'operator.approved' : 'operator.rejected'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      await load()
    }
    catch (error: unknown) {
      failureToast(toast, t('operator.approvalFailed'), error)
    }
    finally {
      pendingId.value = null
      pendingDecision.value = null
    }
  }

  return { decide, items, load, loading, pendingDecision, pendingId }
}

export function useOperatorActivity(getBusinessId: () => string | undefined) {
  const toast = useToast()
  const { t } = useI18n()

  const items = ref<OperatorActivityItem[]>([])
  const loading = ref(false)

  async function load(): Promise<void> {
    const businessId = getBusinessId()
    if (!businessId) {
      items.value = []
      return
    }
    loading.value = true
    try {
      const response = await $fetch<{ runs?: OperatorRunRow[] }>('/api/v1/agent/runs', {
        query: { businessId },
      })
      items.value = buildActivity(response.runs ?? [])
    }
    catch (error: unknown) {
      items.value = []
      log.error({ message: 'operator activity failed to load', error: String(error) })
      failureToast(toast, t('operator.activityFailed'), error)
    }
    finally {
      loading.value = false
    }
  }

  /** The run still going; a finished one has nothing left to stop. */
  const stoppingId = ref<string | null>(null)
  const clearing = ref(false)

  async function stop(item: AwaitingApproval | OperatorActivityItem): Promise<void> {
    if (stoppingId.value) return
    stoppingId.value = item.id
    try {
      await $fetch(`/api/v1/agent/runs/${item.id}/cancel`, { method: 'POST' })
      toast.add({
        title: t('activity.stopped'),
        icon: 'i-heroicons-stop-circle',
        color: 'success',
      })
      await load()
    }
    catch (error: unknown) {
      failureToast(toast, t('activity.stopFailed'), error)
    }
    finally {
      stoppingId.value = null
    }
  }

  /** Drop the finished history. Runs still going are kept, on purpose. */
  async function clear(): Promise<void> {
    const businessId = getBusinessId()
    if (!businessId || clearing.value) return
    clearing.value = true
    try {
      const result = await $fetch<{ removed: number }>('/api/v1/agent/runs/clear', {
        method: 'POST',
        body: { businessId },
      })
      items.value = items.value.filter(item => item.status === 'running')
      toast.add({
        title: t('activity.cleared', { count: result.removed }),
        icon: 'i-heroicons-trash',
        color: 'success',
      })
    }
    catch (error: unknown) {
      failureToast(toast, t('activity.clearFailed'), error)
    }
    finally {
      clearing.value = false
    }
  }

  return { clear, clearing, items, load, loading, stop, stoppingId }
}

export function useOperatorSafeMode(getBusinessId: () => string | undefined) {
  const toast = useToast()
  const { t } = useI18n()

  const safeMode = ref(true)
  const switching = ref(false)

  async function load(): Promise<void> {
    const businessId = getBusinessId()
    if (!businessId) return
    try {
      const response = await $fetch<{ safeMode: boolean }>(`/api/v1/business/${businessId}/safe-mode`)
      safeMode.value = response.safeMode
    }
    catch (error: unknown) {
      // Fail closed: without the setting, the badge keeps asking first.
      safeMode.value = true
      log.error({ message: 'operator safe mode failed to load', error: String(error) })
      failureToast(toast, t('operator.safeModeLoadFailed'), error)
    }
  }

  async function toggle(): Promise<void> {
    const businessId = getBusinessId()
    if (!businessId || switching.value) return
    switching.value = true
    try {
      const response = await $fetch<{ safeMode: boolean }>(`/api/v1/business/${businessId}/safe-mode`, {
        method: 'PUT',
        body: { safeMode: !safeMode.value },
      })
      safeMode.value = response.safeMode
      toast.add({
        title: t(response.safeMode ? 'operator.safeModeOn' : 'operator.safeModeOff'),
        icon: 'i-heroicons-shield-check',
        color: 'success',
      })
    }
    catch (error: unknown) {
      failureToast(toast, t('operator.safeModeFailed'), error)
    }
    finally {
      switching.value = false
    }
  }

  return { load, safeMode, switching, toggle }
}
