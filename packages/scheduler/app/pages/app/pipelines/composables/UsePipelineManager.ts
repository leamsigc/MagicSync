import type { AgentRun, Pipeline, PipelineRun } from '#layers/BaseDB/db/schema'

export type PipelineRunStatus = 'queued' | 'running' | 'waiting_input' | 'waiting_review' | 'changes_requested' | 'completed' | 'failed' | 'cancelled'

export interface PipelineRunInput {
  brief: string
  useBusinessContext: boolean
}

interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Pipeline Manager Composable for handling content-workflow pipeline operations.
 * Mirrors UsePostManager: loading + error states, toast feedback on outcomes.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */
export const usePipelineManager = () => {
  const { t } = useI18n()
  const toast = useToast()
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pipelineList = useState<Pipeline[]>('pipelines:list', () => [] as Pipeline[])
  const runList = useState<PipelineRun[]>('pipelines:runs', () => [] as PipelineRun[])
  const agentRunList = useState<AgentRun[]>('pipelines:agent-runs', () => [] as AgentRun[])
  const activeBusinessId = useState<string>('business:id')

  const readError = (err: unknown, fallback: string) => {
    const fetchError = err as { data?: { message?: string, statusMessage?: string }, message?: string }
    return fetchError.data?.message || fetchError.data?.statusMessage || fetchError.message || fallback
  }

  const lastStepName = (raw: unknown): string => {
    try {
      const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : []
      const list = Array.isArray(parsed) ? parsed : []
      const last = list[list.length - 1] as { name?: unknown } | undefined
      return typeof last?.name === 'string' && last.name ? last.name : '…'
    }
    catch {
      return '…'
    }
  }

  const upsertRun = (run: PipelineRun) => {
    const index = runList.value.findIndex(item => item.id === run.id)
    if (index === -1) {
      runList.value.unshift(run)
      return
    }
    runList.value[index] = run
  }

  /**
   * Fetch all pipelines for a business (seeds default social_pipeline on first call)
   */
  const fetchPipelines = async (businessId: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<Pipeline[]>>('/api/v1/pipelines', {
        query: { businessId }
      })
      pipelineList.value = response.data ?? []
      return pipelineList.value
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.loadFailed'))
      toast.add({ title: t('toast.loadFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Get a single pipeline by id
   */
  const getPipeline = async (id: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<Pipeline>>(`/api/v1/pipelines/${id}`)
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.loadFailed'))
      toast.add({ title: t('toast.loadFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Create a new pipeline
   */
  const createPipeline = async (payload: { businessId: string, name: string, description?: string }) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<Pipeline>>('/api/v1/pipelines', {
        method: 'POST',
        body: { ...payload, steps: [] }
      })
      if (response.data) {
        pipelineList.value.unshift(response.data)
      }
      toast.add({ title: t('toast.pipelineCreated'), icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.createFailed'))
      toast.add({ title: t('toast.createFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Update a pipeline (rename and/or replace steps from the studio)
   */
  const updatePipeline = async (id: string, payload: { steps: Array<{ id: string, name: string, type: string, prompt?: string, kind?: string, position?: { x: number, y: number }, config?: Record<string, unknown>, next?: string[] }>, name?: string }) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<Pipeline>>(`/api/v1/pipelines/${id}`, {
        method: 'PUT',
        body: payload
      })
      if (response.data) {
        const index = pipelineList.value.findIndex(item => item.id === id)
        if (index !== -1) {
          pipelineList.value[index] = response.data
        }
      }
      toast.add({ title: t('toast.pipelineSaved'), icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.saveFailed'))
      toast.add({ title: t('toast.saveFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  const refreshPipelineRow = (row: Pipeline | null) => {
    if (!row) return
    const index = pipelineList.value.findIndex(item => item.id === row.id)
    if (index !== -1) {
      pipelineList.value[index] = row
    } else {
      pipelineList.value.push(row)
    }
  }

  const saveGraph = async (id: string, graph: unknown) => {
    isLoading.value = true
    error.value = null
    try {
      const response = await $fetch<ServiceResult<Pipeline>>(`/api/v1/pipelines/${id}/graph`, {
        method: 'PUT',
        body: { graph }
      })
      refreshPipelineRow(response.data ?? null)
      toast.add({ title: t('toast.graphSaved'), icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.saveFailed'))
      toast.add({ title: error.value, icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  const activatePipeline = async (id: string) => {
    isLoading.value = true
    error.value = null
    try {
      const response = await $fetch<ServiceResult<Pipeline>>(`/api/v1/pipelines/${id}/activate`, { method: 'POST' })
      refreshPipelineRow(response.data ?? null)
      toast.add({ title: t('toast.activated'), icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.saveFailed'))
      toast.add({ title: error.value, icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  const archivePipeline = async (id: string) => {
    isLoading.value = true
    error.value = null
    try {
      const response = await $fetch<ServiceResult<Pipeline>>(`/api/v1/pipelines/${id}/archive`, { method: 'POST' })
      refreshPipelineRow(response.data ?? null)
      toast.add({ title: t('toast.archived'), icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.saveFailed'))
      toast.add({ title: error.value, icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  const clonePipeline = async (id: string) => {
    isLoading.value = true
    error.value = null
    try {
      const response = await $fetch<ServiceResult<Pipeline>>(`/api/v1/pipelines/${id}/clone`, { method: 'POST' })
      refreshPipelineRow(response.data ?? null)
      toast.add({ title: t('toast.cloned'), icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.saveFailed'))
      toast.add({ title: error.value, icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Delete a pipeline (runs cascade) and drop it from local state
   */
  const deletePipeline = async (id: string) => {
    isLoading.value = true
    error.value = null

    try {
      await $fetch(`/api/v1/pipelines/${id}`, { method: 'DELETE' })
      pipelineList.value = pipelineList.value.filter(pipeline => pipeline.id !== id)
      runList.value = runList.value.filter(run => run.pipelineId !== id)
      toast.add({ title: t('toast.pipelineDeleted'), icon: 'i-heroicons-check-circle', color: 'success' })
      return true
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.pipelineDeleteFailed'))
      toast.add({ title: t('toast.pipelineDeleteFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Start a new run for a pipeline
   */
  const startRun = async (pipelineId: string, businessId: string, input: PipelineRunInput) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<PipelineRun>>(`/api/v1/pipelines/${pipelineId}/runs`, {
        method: 'POST',
        body: { businessId, input }
      })
      if (response.data) {
        upsertRun(response.data)
      }
      toast.add({ title: t('toast.runStarted'), icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.runStartFailed'))
      toast.add({ title: t('toast.runStartFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Get a single pipeline run by id (also tracks it for the board)
   */
  const getRun = async (runId: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<PipelineRun>>(`/api/v1/pipelines/runs/${runId}`)
      if (response.data) {
        upsertRun(response.data)
      }
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.loadFailed'))
      toast.add({ title: t('toast.loadFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Advance a run: approve moves forward, feedback sends back to waiting_input
   */
  const advanceRun = async (runId: string, approved: boolean, feedback?: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<PipelineRun>>(`/api/v1/pipelines/runs/${runId}/advance`, {
        method: 'POST',
        body: { approved, feedback: feedback ?? '' }
      })
      if (response.data) {
        upsertRun(response.data)
      }
      const title = approved ? t('toast.runApproved') : t('toast.changesSent')
      toast.add({ title, icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.advanceFailed'))
      toast.add({ title: t('toast.advanceFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch agent runs, optionally scoped to one pipeline run
   */
  const fetchAgentRuns = async (pipelineRunId?: string, filters: { businessId?: string, status?: string } = {}) => {
    isLoading.value = true
    error.value = null

    try {
      const query = pipelineRunId
        ? { pipelineRunId, limit: 50, ...filters }
        : { limit: 50, ...filters }
      const response = await $fetch<ServiceResult<AgentRun[]>>('/api/v1/pipelines/agent-runs', { query })
      agentRunList.value = response.data ?? []
      return agentRunList.value
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.loadFailed'))
      toast.add({ title: t('toast.loadFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch all runs for a business (server-backed board)
   */
  const fetchRuns = async (businessId: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<PipelineRun[]>>('/api/v1/pipelines/runs', {
        query: { businessId }
      })
      runList.value = response.data ?? []
      return runList.value
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.loadFailed'))
      toast.add({ title: t('toast.loadFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Queue a post-approval quick action (posts/carousels/reels ×N days, drafts first)
   */
  const runQuickAction = async (businessId: string, action: string, days: number) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<PipelineRun[]>>('/api/v1/pipelines/quick-actions', {
        method: 'POST',
        body: { businessId, action, days }
      })
      for (const run of response.data ?? []) {
        upsertRun(run)
      }
      return response.data ?? []
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.quickFailed'))
      toast.add({ title: t('toast.quickFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Execute the next pending step of a run (server runs ONE step per call)
   */
  const executeStep = async (runId: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<PipelineRun>>(`/api/v1/pipelines/runs/${runId}/execute`, {
        method: 'POST'
      })
      if (response.data) {
        upsertRun(response.data)
      }
      const step = lastStepName(response.data?.stepResults)
      toast.add({ title: t('toast.stepExecuted', { step }), icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.executeFailed'))
      toast.add({ title: t('toast.executeFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Reset a run back to a step (run returns to running)
   */
  const resetRun = async (runId: string, step: number) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<PipelineRun>>(`/api/v1/pipelines/runs/${runId}/reset`, {
        method: 'POST',
        body: { step }
      })
      if (response.data) {
        upsertRun(response.data)
      }
      toast.add({ title: t('toast.resetDone', { step: step + 1 }), icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.resetFailed'))
      toast.add({ title: t('toast.resetFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Pause a running run (run moves to waiting_input with a paused marker)
   */
  const pauseRun = async (runId: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<PipelineRun>>(`/api/v1/pipelines/runs/${runId}/pause`, {
        method: 'POST'
      })
      if (response.data) {
        upsertRun(response.data)
      }
      toast.add({ title: t('steps.paused'), icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('steps.pause'))
      toast.add({ title: t('steps.pause'), description: error.value, icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Resume a paused run (run returns to running with a resumed marker)
   */
  const resumeRun = async (runId: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<PipelineRun>>(`/api/v1/pipelines/runs/${runId}/resume`, {
        method: 'POST'
      })
      if (response.data) {
        upsertRun(response.data)
      }
      toast.add({ title: t('steps.resumed'), icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('steps.resume'))
      toast.add({ title: t('steps.resume'), description: error.value, icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Delete a single pipeline run and drop it from local state
   */
  const deleteRun = async (runId: string) => {
    isLoading.value = true
    error.value = null

    try {
      await $fetch(`/api/v1/pipelines/runs/${runId}`, { method: 'DELETE' })
      runList.value = runList.value.filter(run => run.id !== runId)
      toast.add({ title: t('toast.runDeleted'), icon: 'i-heroicons-check-circle', color: 'success' })
      return true
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.runDeleteFailed'))
      toast.add({ title: t('toast.runDeleteFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Update a run's steerable input (brief + business-context flag)
   */
  const updateInput = async (runId: string, payload: { brief?: string, useBusinessContext?: boolean }) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ServiceResult<PipelineRun>>(`/api/v1/pipelines/runs/${runId}/input`, {
        method: 'PUT',
        body: payload
      })
      if (response.data) {
        upsertRun(response.data)
      }
      toast.add({ title: t('toast.inputSaved'), icon: 'i-heroicons-check-circle', color: 'success' })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.inputFailed'))
      toast.add({ title: t('toast.inputFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Log an agent run for oversight
   */
  const logAgentRun = async (payload: { pipelineRunId?: string, agentName: string, tokensUsed?: number, summary?: string }) => {
    try {
      const response = await $fetch<ServiceResult<AgentRun>>('/api/v1/pipelines/agent-runs', {
        method: 'POST',
        body: payload
      })
      return response.data ?? null
    }
    catch (err: unknown) {
      error.value = readError(err, t('toast.advanceFailed'))
      toast.add({ title: t('toast.advanceFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    }
  }

  return {
    // State
    isLoading: readonly(isLoading),
    error: readonly(error),
    pipelineList,
    runList,
    agentRunList,
    activeBusinessId,

    // Methods
    fetchPipelines,
    getPipeline,
    createPipeline,
    deletePipeline,
    updatePipeline,
    saveGraph,
    activatePipeline,
    archivePipeline,
    clonePipeline,
    startRun,
    getRun,
    fetchRuns,
    deleteRun,
    advanceRun,
    executeStep,
    resetRun,
    pauseRun,
    resumeRun,
    updateInput,
    runQuickAction,
    fetchAgentRuns,
    logAgentRun,
    t,

    // Utilities
    clearError: () => error.value = null
  }
}
