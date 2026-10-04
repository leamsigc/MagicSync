<i18n src="./publishing.json"></i18n>
<script setup lang="ts">
interface PublishConnection {
  id: string
  provider: 'github' | 'wordpress'
  name: string
  config: string
  deliveryMode: string
  isActive: boolean
  hasSecret: boolean
}

interface PublishingJob {
  id: string
  status: string
  attemptCount: number
  remoteUrl?: string | null
  pullRequestUrl?: string | null
  errorMessage?: string | null
  artifactId?: string | null
  updatedAt?: string
}

interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const businessId = route.params.id as string

const pageBusy = ref(true)
const busyId = ref<string | null>(null)
const saving = ref(false)
const testing = ref(false)
const showCreateModal = ref(false)
const connections = ref<PublishConnection[]>([])
const jobs = ref<PublishingJob[]>([])

const form = ref({
  provider: 'github' as 'github' | 'wordpress',
  name: '',
  deliveryMode: 'commit',
  repo: '',
  branch: 'main',
  dir: 'posts',
  siteUrl: '',
  username: '',
  allowLive: false,
  secret: '',
})

function readErrorMessage(err: unknown): string {
  const fetchError = err as { data?: { message?: string, statusMessage?: string }, message?: string }
  return fetchError.data?.message || fetchError.data?.statusMessage || fetchError.message || t('toast.loadFailed')
}

function handleGoBack() {
  router.push(`/app/business/${businessId}/playbook`)
}

function modeOptions(): Array<{ label: string, value: string }> {
  if (form.value.provider === 'github') {
    return [
      { label: t('modes.commit'), value: 'commit' },
      { label: t('modes.pr'), value: 'pr' },
    ]
  }
  return [
    { label: t('modes.draft'), value: 'draft' },
    { label: t('modes.live'), value: 'live' },
  ]
}

function buildConfig(): Record<string, unknown> {
  if (form.value.provider === 'github') {
    return { repo: form.value.repo, branch: form.value.branch, dir: form.value.dir }
  }
  return { siteUrl: form.value.siteUrl, username: form.value.username, allowLive: form.value.allowLive }
}

async function loadAll() {
  pageBusy.value = true
  try {
    const [connectionsRes, jobsRes] = await Promise.all([
      $fetch<ServiceResult<PublishConnection[]>>(`/api/v1/publishing/connections?businessId=${businessId}`),
      $fetch<ServiceResult<PublishingJob[]>>(`/api/v1/publishing/jobs?businessId=${businessId}`),
    ])
    connections.value = connectionsRes.data ?? []
    jobs.value = jobsRes.data ?? []
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.loadFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    pageBusy.value = false
  }
}

function resetForm() {
  form.value = {
    provider: 'github', name: '', deliveryMode: 'commit',
    repo: '', branch: 'main', dir: 'posts',
    siteUrl: '', username: '', allowLive: false, secret: '',
  }
}

function handleOpenCreate() {
  resetForm()
  showCreateModal.value = true
}

function handleCloseCreate() {
  showCreateModal.value = false
}

function handleProviderChange() {
  form.value.deliveryMode = form.value.provider === 'github' ? 'commit' : 'draft'
}

async function handleCreateConnection() {
  if (!form.value.name.trim()) {
    toast.add({ title: t('form.nameRequired'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  saving.value = true
  try {
    await $fetch('/api/v1/publishing/connections', {
      method: 'POST',
      body: {
        businessId,
        provider: form.value.provider,
        name: form.value.name.trim(),
        deliveryMode: form.value.deliveryMode,
        config: buildConfig(),
        secret: form.value.secret || undefined,
      },
    })
    showCreateModal.value = false
    await loadAll()
    toast.add({ title: t('toast.createDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.createFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function handleTestConnection(id: string) {
  busyId.value = id
  try {
    const res = await $fetch<ServiceResult<{ ok: boolean, detail: string }>>(`/api/v1/publishing/connections/${id}/test`, { method: 'POST' })
    if (res.data?.ok) {
      toast.add({ title: t('toast.testOk'), description: res.data.detail, icon: 'i-heroicons-check-circle', color: 'success' })
    }
    else {
      toast.add({ title: t('toast.testFailed'), description: res.data?.detail, icon: 'i-heroicons-x-circle', color: 'error' })
    }
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.testFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyId.value = null
  }
}

async function handleDeleteConnection(id: string) {
  busyId.value = id
  try {
    await $fetch(`/api/v1/publishing/connections/${id}`, { method: 'DELETE' })
    await loadAll()
    toast.add({ title: t('toast.deleteDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.deleteFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyId.value = null
  }
}

async function handleRetryJob(id: string) {
  busyId.value = id
  try {
    await $fetch(`/api/v1/publishing/jobs/${id}/retry`, { method: 'POST' })
    await loadAll()
    toast.add({ title: t('toast.retryDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.retryFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyId.value = null
  }
}

function jobStatusColor(status: string): string {
  if (status === 'succeeded') return 'success'
  if (status === 'failed' || status === 'conflict') return 'error'
  if (status === 'running') return 'info'
  return 'neutral'
}

onMounted(loadAll)
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <BasePageHeader :title="t('title')" :description="t('description')">
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <UButton variant="ghost" color="neutral" icon="i-heroicons-arrow-left" @click="handleGoBack">
            {{ t('back') }}
          </UButton>
          <UButton color="primary" variant="solid" icon="i-heroicons-plus" data-testid="publishing-create" @click="handleOpenCreate">
            {{ t('form.cta') }}
          </UButton>
        </div>
      </template>
    </BasePageHeader>

    <div v-if="pageBusy" class="flex items-center justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="size-6 animate-spin" />
    </div>

    <template v-else>
      <UAlert color="warning" variant="subtle" icon="i-heroicons-shield-check" :title="t('policy.title')" :description="t('policy.description')" />

      <UCard v-motion-fade-visible :duration="200">
        <template #header>
          <h2 class="font-semibold">{{ t('connections.title') }}</h2>
        </template>
        <div v-if="connections.length === 0" class="py-4 text-center text-sm text-muted">
          {{ t('connections.empty') }}
        </div>
        <ul v-else class="space-y-2">
          <li v-for="connection in connections" :key="connection.id" :data-testid="`publishing-connection-${connection.id}`" class="flex flex-wrap items-center gap-2 rounded-xl bg-elevated p-3">
            <span class="text-sm font-semibold">{{ connection.name }}</span>
            <UBadge color="neutral" variant="outline" size="xs">{{ connection.provider }}</UBadge>
            <UBadge color="neutral" variant="subtle" size="xs">{{ connection.deliveryMode }}</UBadge>
            <UBadge :color="connection.hasSecret ? 'success' : 'warning'" variant="subtle" size="xs">
              {{ connection.hasSecret ? t('connections.hasSecret') : t('connections.noSecret') }}
            </UBadge>
            <span class="ms-auto flex gap-1">
              <UButton color="neutral" variant="ghost" size="xs" :loading="busyId === connection.id" @click="handleTestConnection(connection.id)">
                {{ t('connections.test') }}
              </UButton>
              <UButton color="error" variant="ghost" size="xs" :loading="busyId === connection.id" @click="handleDeleteConnection(connection.id)">
                {{ t('connections.delete') }}
              </UButton>
            </span>
          </li>
        </ul>
      </UCard>

      <UCard v-motion-fade-visible :duration="200">
        <template #header>
          <h2 class="font-semibold">{{ t('jobs.title') }}</h2>
        </template>
        <div v-if="jobs.length === 0" class="py-4 text-center text-sm text-muted">
          {{ t('jobs.empty') }}
        </div>
        <ul v-else class="space-y-2">
          <li v-for="job in jobs" :key="job.id" class="flex flex-wrap items-center gap-2 rounded-xl bg-elevated p-3 text-xs">
            <UBadge :color="jobStatusColor(job.status)" variant="subtle" class="capitalize">
              {{ t(`jobs.statuses.${job.status}`) }}
            </UBadge>
            <span class="text-muted">{{ t('jobs.attempts', { count: job.attemptCount }) }}</span>
            <NuxtLink v-if="job.remoteUrl || job.pullRequestUrl" :to="job.remoteUrl || job.pullRequestUrl || ''" target="_blank" class="text-primary underline">
              {{ t('jobs.remote') }}
            </NuxtLink>
            <span v-if="job.errorMessage" class="w-full text-error">{{ job.errorMessage }}</span>
            <span class="ms-auto">
              <UButton
                v-if="job.status === 'failed' || job.status === 'conflict'"
                color="neutral" variant="ghost" size="xs"
                :loading="busyId === job.id"
                @click="handleRetryJob(job.id)"
              >
                {{ t('jobs.retry') }}
              </UButton>
            </span>
          </li>
        </ul>
      </UCard>
    </template>

    <UModal v-model:open="showCreateModal" :title="t('form.title')" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div class="space-y-3">
          <UFormField :label="t('form.name')" name="publishing-name">
            <UInput v-model="form.name" class="w-full" />
          </UFormField>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField :label="t('form.provider')" name="publishing-provider">
              <USelect v-model="form.provider" :items="[{ label: 'GitHub', value: 'github' }, { label: 'WordPress', value: 'wordpress' }]" value-key="value" class="w-full" @update:model-value="handleProviderChange" />
            </UFormField>
            <UFormField :label="t('form.mode')" name="publishing-mode">
              <USelect v-model="form.deliveryMode" :items="modeOptions()" value-key="value" class="w-full" />
            </UFormField>
          </div>
          <template v-if="form.provider === 'github'">
            <UFormField :label="t('form.repo')" name="publishing-repo">
              <UInput v-model="form.repo" placeholder="owner/repository" class="w-full font-mono text-xs" />
            </UFormField>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField :label="t('form.branch')" name="publishing-branch">
                <UInput v-model="form.branch" class="w-full font-mono text-xs" />
              </UFormField>
              <UFormField :label="t('form.dir')" name="publishing-dir">
                <UInput v-model="form.dir" class="w-full font-mono text-xs" />
              </UFormField>
            </div>
          </template>
          <template v-else>
            <UFormField :label="t('form.siteUrl')" name="publishing-site">
              <UInput v-model="form.siteUrl" placeholder="https://example.com" class="w-full font-mono text-xs" />
            </UFormField>
            <UFormField :label="t('form.username')" name="publishing-user">
              <UInput v-model="form.username" class="w-full font-mono text-xs" />
            </UFormField>
          </template>
          <UFormField :label="t('form.secret')" name="publishing-secret" :hint="t('form.secretHint')">
            <UInput v-model="form.secret" type="password" class="w-full font-mono text-xs" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="handleCloseCreate">
            {{ t('form.cancel') }}
          </UButton>
          <UButton color="primary" variant="solid" :loading="saving" @click="handleCreateConnection">
            {{ t('form.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped></style>
