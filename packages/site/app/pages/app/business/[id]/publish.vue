<i18n src="./publish.json"></i18n>
<script setup lang="ts">
interface Preview {
  repository: string
  framework: string
  contentSystem: string
  language: string
  target: string
  template: string | null
  branch: string
  action: string
}

interface Connection {
  id: string
  provider: 'github' | 'wordpress'
  name: string
  config: string
  deliveryMode: string
}

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const businessId = route.params.id as string

const destination = ref<'github' | 'wordpress' | null>(null)
const connections = ref<Connection[]>([])
const selectedConn = ref<string>('')
const repository = ref('')
const language = ref('en')
const slug = ref('')
const title = ref('')
const brief = ref('')
const targetPath = ref('')
const excerpt = ref('')
const category = ref('')
const tags = ref('')
const wpContent = ref('')
const status = ref<'draft' | 'publish'>('draft')
const branch = ref('main')
const inspection = ref<Record<string, unknown> | null>(null)
const preview = ref<Preview | null>(null)
const markdownPreview = ref('')
const artifactId = ref<string | null>(null)
const jobId = ref<string | null>(null)
const remoteUrl = ref<string | null>(null)
const inspecting = ref(false)
const previewing = ref(false)
const preparing = ref(false)
const publishing = ref(false)
const verifying = ref(false)
const fileExists = ref(false)

useHead({
  title: t('seo_title'),
  meta: [{ name: 'description', content: t('seo_description') }],
})

function handleBack() {
  router.push(`/app/business/${businessId}/publishing`)
}

function errorMessage(error: unknown): string {
  const data = (error as { data?: { statusMessage?: string, message?: string } } | null)?.data
  return data?.statusMessage || data?.message || (error instanceof Error ? error.message : String(error))
}

function handleSelectGithub() {
  destination.value = 'github'
}

function handleSelectWordpress() {
  destination.value = 'wordpress'
}

function handleClearDestination() {
  destination.value = null
}

async function handleFetchConnections() {
  try {
    const res = await $fetch<{ success: boolean, data?: Connection[] }>('/api/v1/publishing/connections', { query: { businessId } })
    connections.value = res.data ?? []
    const github = connections.value.find(c => c.provider === 'github')
    if (github) {
      selectedConn.value = github.id
      try {
        const parsed: unknown = JSON.parse(github.config)
        const cfg = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
        repository.value = String(cfg.repo ?? '')
        branch.value = String(cfg.branch ?? 'main')
      } catch { /* ignore */ }
    }
  } catch {
    connections.value = []
  }
}

async function handleInspect() {
  if (!repository.value) {
    toast.add({ title: t('feedback.previewFailed', { error: 'repository required' }), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  inspecting.value = true
  fileExists.value = false
  try {
    const res = await $fetch<{ success: boolean, data?: Record<string, unknown> }>('/api/v1/publishing/destinations/inspect', {
      method: 'POST',
      body: { businessId, provider: 'github', repository: repository.value, branch: branch.value },
    })
    inspection.value = res.data ?? null
    toast.add({ title: t('feedback.inspectDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  } catch (error) {
    toast.add({ title: t('feedback.inspectFailed', { error: errorMessage(error) }), icon: 'i-heroicons-x-circle', color: 'error' })
  } finally {
    inspecting.value = false
  }
}

async function handlePreview() {
  previewing.value = true
  try {
    const res = await $fetch<{ success: boolean, data?: Preview }>('/api/v1/publishing/destinations/preview', {
      method: 'POST',
      body: { businessId, provider: 'github', language: language.value, slug: slug.value || title.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'), repository: repository.value, branch: branch.value, targetPath: targetPath.value || undefined, connectionId: selectedConn.value || undefined },
    })
    preview.value = res.data ?? null
    if (preview.value?.target) targetPath.value = preview.value.target
  } catch (error) {
    toast.add({ title: t('feedback.previewFailed', { error: errorMessage(error) }), icon: 'i-heroicons-x-circle', color: 'error' })
  } finally {
    previewing.value = false
  }
}

async function handlePrepareGithub() {
  preparing.value = true
  fileExists.value = false
  try {
    const res = await $fetch<{ success: boolean, data?: { artifactId: string, markdown: string, preview: Preview } }>('/api/v1/publishing/destinations/prepare-github', {
      method: 'POST',
      body: { businessId, title: title.value, brief: brief.value, language: language.value, slug: slug.value || undefined, repository: repository.value || undefined, branch: branch.value || undefined, targetPath: targetPath.value || undefined, connectionId: selectedConn.value || undefined },
    })
    artifactId.value = res.data?.artifactId ?? null
    markdownPreview.value = res.data?.markdown ?? ''
    preview.value = res.data?.preview ?? preview.value
    toast.add({ title: t('feedback.prepareDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  } catch (error: unknown) {
    const msg = errorMessage(error)
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (statusCode === 409) {
      fileExists.value = true
      toast.add({ title: t('feedback.fileExists'), icon: 'i-heroicons-x-circle', color: 'warning' })
    } else if (statusCode === 422) {
      toast.add({ title: t('feedback.piiBlocked', { error: msg }), icon: 'i-heroicons-x-circle', color: 'error' })
    } else {
      toast.add({ title: t('feedback.prepareFailed', { error: msg }), icon: 'i-heroicons-x-circle', color: 'error' })
    }
  } finally {
    preparing.value = false
  }
}

async function handleApprove() {
  if (!artifactId.value) return
  publishing.value = true
  try {
    const reviewed = await $fetch<{ success: boolean, data?: { artifact?: { version: number } } }>(`/api/v1/artifacts/${artifactId.value}/review`, {
      method: 'POST',
      query: { businessId },
      body: { decision: 'approved', feedback: '', version: 1 },
    })
    const version = reviewed.data?.artifact?.version ?? 1
    void version
    const res = await $fetch<{ success: boolean, data?: { jobId: string } }>('/api/v1/publishing/destinations/publish', {
      method: 'POST',
      body: { businessId, artifactId: artifactId.value, connectionId: selectedConn.value || undefined },
    })
    jobId.value = res.data?.jobId ?? null
    toast.add({ title: t('feedback.publishDone'), icon: 'i-heroicons-check-circle', color: 'success' })
    await handleVerify()
  } catch (error) {
    toast.add({ title: t('feedback.publishFailed', { error: errorMessage(error) }), icon: 'i-heroicons-x-circle', color: 'error' })
  } finally {
    publishing.value = false
  }
}

async function handleVerify() {
  if (!jobId.value) return
  verifying.value = true
  try {
    const res = await $fetch<{ success: boolean, data?: { verified: boolean, detail: string } }>('/api/v1/publishing/destinations/verify', {
      method: 'POST',
      body: { businessId, jobId: jobId.value },
    })
    if (res.data?.verified) {
      toast.add({ title: t('feedback.verifyDone'), description: res.data.detail, icon: 'i-heroicons-check-circle', color: 'success' })
    }
  } catch (error) {
    toast.add({ title: t('feedback.verifyFailed', { error: errorMessage(error) }), icon: 'i-heroicons-x-circle', color: 'error' })
  } finally {
    verifying.value = false
  }
}

async function handlePrepareWordpress() {
  preparing.value = true
  try {
    const res = await $fetch<{ success: boolean, data?: { artifactId: string } }>('/api/v1/publishing/destinations/prepare-wordpress', {
      method: 'POST',
      body: { businessId, title: title.value, slug: slug.value || undefined, content: wpContent.value, excerpt: excerpt.value || undefined, category: category.value || undefined, tags: tags.value ? tags.value.split(',').map(s => s.trim()).filter(Boolean) : undefined, status: status.value, language: language.value },
    })
    artifactId.value = res.data?.artifactId ?? null
    toast.add({ title: t('feedback.prepareDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  } catch (error: unknown) {
    const msg = errorMessage(error)
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (statusCode === 422) toast.add({ title: t('feedback.piiBlocked', { error: msg }), icon: 'i-heroicons-x-circle', color: 'error' })
    else toast.add({ title: t('feedback.prepareFailed', { error: msg }), icon: 'i-heroicons-x-circle', color: 'error' })
  } finally {
    preparing.value = false
  }
}

function handleEdit() {
  artifactId.value = null
  markdownPreview.value = ''
}

function handleCancel() {
  artifactId.value = null
  markdownPreview.value = ''
  fileExists.value = false
}

onMounted(() => {
  void handleFetchConnections()
})
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <div class="flex items-center gap-3">
      <UButton variant="ghost" color="neutral" icon="i-heroicons-arrow-left" @click="handleBack">{{ t('back') }}</UButton>
      <div>
        <h1 class="text-lg font-semibold">{{ t('title') }}</h1>
        <p class="text-sm text-muted">{{ t('description') }}</p>
      </div>
    </div>

    <UCard v-if="!destination" v-motion-fade :duration="200">
      <template #header>
        <h2 class="font-semibold">{{ t('destination.title') }}</h2>
      </template>
      <div class="flex flex-wrap gap-3">
        <UButton color="primary" size="lg" icon="i-simple-icons-github" @click="handleSelectGithub">{{ t('destination.github') }}</UButton>
        <UButton color="primary" variant="outline" size="lg" icon="i-simple-icons-wordpress" @click="handleSelectWordpress">{{ t('destination.wordpress') }}</UButton>
      </div>
    </UCard>

    <template v-else>
      <div class="flex items-center gap-2">
        <UBadge color="primary" variant="subtle">{{ destination }}</UBadge>
        <UButton size="xs" variant="ghost" color="neutral" @click="handleClearDestination">{{ t('github.cancel') }}</UButton>
      </div>

      <UCard v-if="destination === 'github'" v-motion-fade :duration="200">
        <template #header>
          <h2 class="font-semibold">{{ t('destination.github') }}</h2>
        </template>
        <div class="space-y-4">
          <UFormField :label="t('github.repository')">
            <UInput v-model="repository" placeholder="owner/project" class="w-full font-mono text-xs" />
          </UFormField>
          <div class="grid gap-3 sm:grid-cols-3">
            <UFormField :label="t('github.language')"><USelect v-model="language" :items="[{ label: 'English', value: 'en' }, { label: 'German', value: 'de' }, { label: 'Spanish', value: 'es' }]" class="w-full" /></UFormField>
            <UFormField :label="t('github.slug')"><UInput v-model="slug" placeholder="my-article" class="w-full font-mono text-xs" /></UFormField>
            <UFormField :label="t('github.branch')"><UInput v-model="branch" class="w-full font-mono text-xs" /></UFormField>
          </div>
          <UFormField :label="t('github.titleLabel')"><UInput v-model="title" class="w-full" /></UFormField>
          <UFormField :label="t('github.brief')"><UTextarea v-model="brief" :rows="3" class="w-full" /></UFormField>
          <div class="flex flex-wrap gap-2">
            <UButton :loading="inspecting" icon="i-heroicons-magnifying-glass" @click="handleInspect">{{ t('github.inspect') }}</UButton>
            <UButton :loading="previewing" variant="outline" @click="handlePreview">{{ t('github.preview') }}</UButton>
          </div>
          <div v-if="inspection" class="rounded-xl bg-elevated p-3 text-xs font-mono">
            <p>Framework: {{ (inspection as Record<string, unknown>).framework }}</p>
            <p>Content: {{ (inspection as Record<string, unknown>).contentSystem }}</p>
            <p>Dir: {{ (inspection as Record<string, unknown>).contentDir }}</p>
          </div>
          <UCard v-if="preview" class="bg-elevated">
            <p class="text-xs">{{ t('preview.repository', { repo: preview.repository }) }}</p>
            <p class="text-xs">{{ t('preview.framework', { framework: preview.framework }) }}</p>
            <p class="text-xs">{{ t('preview.content', { system: preview.contentSystem }) }}</p>
            <p class="text-xs">{{ t('preview.language', { language: preview.language }) }}</p>
            <p class="text-xs">{{ t('preview.target', { target: preview.target }) }}</p>
            <p class="text-xs">{{ t('preview.template', { template: preview.template ?? 'none' }) }}</p>
            <p class="text-xs">{{ t('preview.branch', { branch: preview.branch }) }}</p>
            <p class="text-xs">{{ t('preview.action', { action: preview.action }) }}</p>
            <UFormField :label="t('github.target')" class="mt-2"><UInput v-model="targetPath" class="w-full font-mono text-xs" /></UFormField>
          </UCard>
          <div v-if="fileExists" class="rounded-xl border border-warning bg-warning/10 p-3 text-sm text-warning">
            {{ t('feedback.fileExists') }}
            <div class="mt-2 flex gap-2">
              <UButton size="xs" color="warning" @click="handlePrepareGithub">Update</UButton>
              <UButton size="xs" variant="outline" @click="handleCancel">Cancel</UButton>
            </div>
          </div>
          <UCard v-if="markdownPreview" class="bg-elevated">
            <template #header><h3 class="text-sm font-semibold">Preview / Diff</h3></template>
            <pre class="whitespace-pre-wrap text-xs">{{ markdownPreview }}</pre>
            <div class="mt-3 flex gap-2">
              <UButton :loading="publishing" color="primary" @click="handleApprove">{{ t('github.approve') }}</UButton>
              <UButton variant="ghost" @click="handleEdit">{{ t('github.edit') }}</UButton>
              <UButton variant="ghost" color="neutral" @click="handleCancel">{{ t('github.cancel') }}</UButton>
            </div>
          </UCard>
          <div v-else class="flex gap-2">
            <UButton :loading="preparing" color="primary" @click="handlePrepareGithub">{{ t('github.prepare') }}</UButton>
          </div>
          <div v-if="jobId" class="flex items-center gap-2 text-xs">
            <UBadge color="success">Job {{ jobId.slice(0, 8) }}</UBadge>
            <UButton size="xs" :loading="verifying" @click="handleVerify">{{ t('github.verify') }}</UButton>
            <NuxtLink v-if="remoteUrl" :to="remoteUrl" target="_blank" class="text-primary underline">{{ t('jobs.pullRequest') }}</NuxtLink>
          </div>
        </div>
      </UCard>

      <UCard v-else v-motion-fade :duration="200">
        <template #header><h2 class="font-semibold">{{ t('destination.wordpress') }}</h2></template>
        <div class="space-y-3">
          <UFormField :label="t('wordpress.titleLabel')"><UInput v-model="title" class="w-full" /></UFormField>
          <UFormField :label="t('wordpress.slug')"><UInput v-model="slug" class="w-full font-mono text-xs" /></UFormField>
          <UFormField :label="t('wordpress.content')"><UTextarea v-model="wpContent" :rows="6" class="w-full" /></UFormField>
          <UFormField :label="t('wordpress.excerpt')"><UInput v-model="excerpt" class="w-full" /></UFormField>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField :label="t('wordpress.category')"><UInput v-model="category" class="w-full" /></UFormField>
            <UFormField :label="t('wordpress.tags')"><UInput v-model="tags" placeholder="tag1, tag2" class="w-full" /></UFormField>
          </div>
          <USelect v-model="status" :items="[{ label: 'Draft', value: 'draft' }, { label: 'Publish', value: 'publish' }]" class="w-48" />
          <div class="flex gap-2">
            <UButton :loading="preparing" color="primary" @click="handlePrepareWordpress">{{ t('wordpress.prepare') }}</UButton>
            <UButton v-if="artifactId" :loading="publishing" @click="handleApprove">{{ t('wordpress.publish') }}</UButton>
          </div>
          <p v-if="artifactId" class="text-xs text-muted">Artifact {{ artifactId.slice(0, 8) }} ready for approval</p>
        </div>
      </UCard>
    </template>
  </div>
</template>
