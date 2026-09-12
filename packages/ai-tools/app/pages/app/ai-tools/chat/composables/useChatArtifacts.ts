export interface ChatArtifact {
  id: string
  kind: string
  status: string
  version: number
  output: string | Record<string, unknown>
  postId?: string | null
  businessId: string
  runId?: string | null
  threadId?: string | null
}

interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

function readErrorMessage(err: unknown, fallback: string): string {
  const fetchError = err as { data?: { message?: string, statusMessage?: string }, message?: string }
  return fetchError.data?.message || fetchError.data?.statusMessage || fetchError.message || fallback
}

function artifactOutput(artifact: ChatArtifact): Record<string, unknown> {
  if (artifact.output && typeof artifact.output === 'object') return artifact.output
  try {
    const parsed: unknown = JSON.parse(typeof artifact.output === 'string' ? artifact.output : '{}')
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  }
  catch {
    return {}
  }
}

export function useChatArtifacts() {
  const { t } = useI18n()
  const toast = useToast()
  const artifacts = ref<ChatArtifact[]>([])
  const loadingList = ref(false)
  const busyId = ref<string | null>(null)

  async function fetchArtifacts(businessId: string | null, threadId: string | null) {
    if (!businessId || !threadId) {
      artifacts.value = []
      return
    }
    loadingList.value = true
    try {
      const res = await $fetch<ServiceResult<ChatArtifact[]>>(
        `/api/v1/artifacts?businessId=${businessId}&threadId=${threadId}`,
      )
      artifacts.value = res.data ?? []
    }
    catch (err: unknown) {
      toast.add({ title: t('artifacts.loadFailed'), description: readErrorMessage(err, t('artifacts.loadFailed')), icon: 'i-heroicons-x-circle', color: 'error' })
    }
    finally {
      loadingList.value = false
    }
  }

  async function submitPostArtifact(businessId: string, threadId: string | null, caption: string) {
    busyId.value = 'new'
    try {
      const res = await $fetch<ServiceResult<ChatArtifact>>('/api/v1/artifacts', {
        method: 'POST',
        body: {
          businessId,
          threadId,
          kind: 'social_post',
          outputKind: 'social_post_draft',
          output: { outputKind: 'social_post_draft', caption, platformVariants: {}, slideCopy: [], cta: '', claims: [], sources: [] },
        },
      })
      if (res.data) artifacts.value.unshift(res.data)
      toast.add({ title: t('artifacts.created'), icon: 'i-heroicons-check-circle', color: 'success' })
    }
    catch (err: unknown) {
      toast.add({ title: t('artifacts.createFailed'), description: readErrorMessage(err, t('artifacts.createFailed')), icon: 'i-heroicons-x-circle', color: 'error' })
    }
    finally {
      busyId.value = null
    }
  }

  async function refreshArtifact(businessId: string, id: string) {
    busyId.value = id
    try {
      const res = await $fetch<ServiceResult<ChatArtifact>>(`/api/v1/artifacts/${id}?businessId=${businessId}`)
      if (res.data) {
        const index = artifacts.value.findIndex(item => item.id === id)
        if (index === -1) artifacts.value.unshift(res.data)
        else artifacts.value[index] = res.data
      }
    }
    catch (err: unknown) {
      toast.add({ title: t('artifacts.loadFailed'), description: readErrorMessage(err, t('artifacts.loadFailed')), icon: 'i-heroicons-x-circle', color: 'error' })
    }
    finally {
      busyId.value = null
    }
  }

  return { artifacts, loadingList, busyId, artifactOutput, fetchArtifacts, submitPostArtifact, refreshArtifact }
}
