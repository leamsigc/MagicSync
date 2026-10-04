<i18n src="./agents.json"></i18n>
<script setup lang="ts">

interface RegistrySkill {
  id: string
  name: string
  slug: string
  description: string
  instructions: string
  allowedTools: string
  sourceType: string
  version: number
  status: 'draft' | 'active' | 'disabled' | 'archived'
}

interface RegistryAgent {
  id: string
  name: string
  description: string
  systemPrompt: string
  skillVersionIds: string
  allowedToolNames: string
  outputKind: string
  maxSteps: number
  requiresBusinessContext: boolean
  requiresHumanReview: boolean
  version: number
  status: 'draft' | 'active' | 'disabled' | 'archived'
}

interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

const { t } = useI18n()
const toast = useToast()
const activeBusinessId = useState<string | null>('business:id', () => null)

const pageBusy = ref(true)
const rowBusyId = ref<string | null>(null)
const seeding = ref(false)
const saving = ref(false)
const showCreateModal = ref(false)
const agents = ref<RegistryAgent[]>([])
const skills = ref<RegistrySkill[]>([])

const newAgent = ref({
  name: '',
  description: '',
  systemPrompt: '',
  outputKind: 'social_post_draft',
  allowedToolNames: '',
  requiresHumanReview: true,
})

function scopeQuery(): string {
  return activeBusinessId.value ? `?businessId=${activeBusinessId.value}` : ''
}

function readErrorMessage(err: unknown): string {
  const fetchError = err as { data?: { message?: string, statusMessage?: string }, message?: string }
  return fetchError.data?.message || fetchError.data?.statusMessage || fetchError.message || t('toast.loadFailed')
}

function toolList(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  }
  catch {
    return []
  }
}

function statusColor(status: string): string {
  if (status === 'active') return 'success'
  if (status === 'draft') return 'warning'
  if (status === 'disabled') return 'error'
  return 'neutral'
}

async function loadAll() {
  pageBusy.value = true
  try {
    const query = scopeQuery()
    const [agentsRes, skillsRes] = await Promise.all([
      $fetch<ServiceResult<RegistryAgent[]>>(`/api/v1/agents${query}`),
      $fetch<ServiceResult<RegistrySkill[]>>(`/api/v1/skills${query}`),
    ])
    agents.value = agentsRes.data ?? []
    skills.value = skillsRes.data ?? []
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.loadFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    pageBusy.value = false
  }
}

async function handleSeed() {
  if (!activeBusinessId.value) {
    toast.add({ title: t('seed.needsBusiness'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  seeding.value = true
  try {
    const res = await $fetch<ServiceResult<{ skills: number, agents: number }>>('/api/v1/agents/seed', {
      method: 'POST',
      body: { businessId: activeBusinessId.value },
    })
    await loadAll()
    toast.add({ title: t('seed.done', { skills: res.data?.skills ?? 0, agents: res.data?.agents ?? 0 }), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('seed.failed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    seeding.value = false
  }
}

function parseToolInput(raw: string): string[] {
  return raw.split(',').map(part => part.trim()).filter(part => part.length > 0)
}

async function handleCreateAgent() {
  if (!newAgent.value.name.trim()) {
    toast.add({ title: t('form.nameRequired'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  saving.value = true
  try {
    await $fetch('/api/v1/agents', {
      method: 'POST',
      body: {
        businessId: activeBusinessId.value,
        name: newAgent.value.name.trim(),
        description: newAgent.value.description,
        systemPrompt: newAgent.value.systemPrompt,
        outputKind: newAgent.value.outputKind,
        allowedToolNames: parseToolInput(newAgent.value.allowedToolNames),
        requiresHumanReview: newAgent.value.requiresHumanReview,
      },
    })
    showCreateModal.value = false
    newAgent.value = { name: '', description: '', systemPrompt: '', outputKind: 'social_post_draft', allowedToolNames: '', requiresHumanReview: true }
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

async function handleAgentAction(id: string, action: 'publish' | 'disable' | 'delete') {
  rowBusyId.value = id
  try {
    await $fetch(`/api/v1/agents/${id}/${action}`, {
      method: action === 'delete' ? 'DELETE' : 'POST',
      body: action === 'delete' ? undefined : {},
      query: activeBusinessId.value ? { businessId: activeBusinessId.value } : {},
    })
    await loadAll()
    toast.add({ title: t(`toast.${action}Done`), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t(`toast.${action}Failed`), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    rowBusyId.value = null
  }
}

function handleOpenCreate() {
  showCreateModal.value = true
}

function handleCloseCreate() {
  showCreateModal.value = false
}

onMounted(loadAll)
watch(activeBusinessId, () => {
  void loadAll()
})
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <BasePageHeader :title="t('title')" :description="t('description')">
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <UButton color="neutral" variant="outline" icon="i-heroicons-sparkles" :loading="seeding"
            data-testid="agents-seed" @click="handleSeed">
            {{ t('seed.cta') }}
          </UButton>
          <UButton color="primary" variant="solid" icon="i-heroicons-plus" data-testid="agents-create"
            @click="handleOpenCreate">
            {{ t('form.cta') }}
          </UButton>
        </div>
      </template>
    </BasePageHeader>

    <div v-if="pageBusy" class="flex items-center justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="size-6 animate-spin" />
    </div>

    <template v-else>
      <UCard v-motion-fade-visible :duration="200">
        <template #header>
          <h2 class="font-semibold">{{ t('agents.title') }}</h2>
          <p class="text-muted text-sm">{{ t('agents.description') }}</p>
        </template>
        <div v-if="agents.length === 0" class="py-4 text-center text-sm text-muted">
          {{ t('agents.empty') }}
        </div>
        <ul v-else class="space-y-2">
          <li v-for="agent in agents" :key="agent.id" :data-testid="`agent-row-${agent.id}`"
            class="rounded-xl bg-elevated p-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-semibold">{{ agent.name }}</span>
              <UBadge :color="statusColor(agent.status)" variant="subtle" size="xs" class="capitalize">
                {{ t(`statuses.${agent.status}`) }}
              </UBadge>
              <UBadge color="neutral" variant="outline" size="xs">v{{ agent.version }}</UBadge>
              <UBadge v-if="agent.requiresHumanReview" color="warning" variant="outline" size="xs">
                {{ t('agents.reviewRequired') }}
              </UBadge>
              <span class="ms-auto flex gap-1">
                <UButton v-if="agent.status === 'draft' || agent.status === 'disabled'" color="primary" variant="ghost"
                  size="xs" :loading="rowBusyId === agent.id" @click="handleAgentAction(agent.id, 'publish')">
                  {{ t('actions.publish') }}
                </UButton>
                <UButton v-if="agent.status === 'active'" color="neutral" variant="ghost" size="xs"
                  :loading="rowBusyId === agent.id" @click="handleAgentAction(agent.id, 'disable')">
                  {{ t('actions.disable') }}
                </UButton>
                <UButton v-if="agent.status !== 'active'" color="error" variant="ghost" size="xs"
                  :loading="rowBusyId === agent.id" @click="handleAgentAction(agent.id, 'delete')">
                  {{ t('actions.delete') }}
                </UButton>
              </span>
            </div>
            <p v-if="agent.description" class="mt-1 text-xs text-muted">{{ agent.description }}</p>
            <div class="mt-2 flex flex-wrap gap-1">
              <UBadge v-for="tool in toolList(agent.allowedToolNames)" :key="tool" color="neutral" variant="outline"
                size="xs">
                {{ tool }}
              </UBadge>
              <UBadge color="neutral" variant="subtle" size="xs">{{ agent.outputKind }}</UBadge>
            </div>
          </li>
        </ul>
      </UCard>

      <UCard v-motion-fade-visible :duration="200">
        <template #header>
          <h2 class="font-semibold">{{ t('skills.title') }}</h2>
          <p class="text-muted text-sm">{{ t('skills.description') }}</p>
        </template>
        <div v-if="skills.length === 0" class="py-4 text-center text-sm text-muted">
          {{ t('skills.empty') }}
        </div>
        <ul v-else class="space-y-2">
          <li v-for="skill in skills" :key="skill.id" class="rounded-xl bg-elevated p-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-semibold">{{ skill.name }}</span>
              <UBadge :color="statusColor(skill.status)" variant="subtle" size="xs" class="capitalize">
                {{ t(`statuses.${skill.status}`) }}
              </UBadge>
              <UBadge color="neutral" variant="outline" size="xs">v{{ skill.version }}</UBadge>
              <UBadge v-if="skill.sourceType === 'imported'" color="warning" variant="outline" size="xs">
                {{ t('skills.imported') }}
              </UBadge>
              <UBadge v-if="skill.sourceType === 'built_in'" color="neutral" variant="outline" size="xs">
                {{ t('skills.builtin') }}
              </UBadge>
            </div>
            <p v-if="skill.description" class="mt-1 text-xs text-muted">{{ skill.description }}</p>
            <div class="mt-2 flex flex-wrap gap-1">
              <UBadge v-for="tool in toolList(skill.allowedTools)" :key="tool" color="neutral" variant="outline"
                size="xs">
                {{ tool }}
              </UBadge>
            </div>
          </li>
        </ul>
      </UCard>
    </template>

    <UModal v-model:open="showCreateModal" :title="t('form.title')" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div class="space-y-3">
          <UFormField :label="t('form.name')" name="agent-name">
            <UInput v-model="newAgent.name" class="w-full" />
          </UFormField>
          <UFormField :label="t('form.description')" name="agent-description">
            <UTextarea v-model="newAgent.description" :rows="2" class="w-full" />
          </UFormField>
          <UFormField :label="t('form.systemPrompt')" name="agent-prompt">
            <UTextarea v-model="newAgent.systemPrompt" :rows="4" class="w-full font-mono text-xs" />
          </UFormField>
          <UFormField :label="t('form.tools')" name="agent-tools">
            <UInput v-model="newAgent.allowedToolNames" placeholder="web_search, retrieve"
              class="w-full font-mono text-xs" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="handleCloseCreate">
            {{ t('form.cancel') }}
          </UButton>
          <UButton color="primary" variant="solid" :loading="saving" @click="handleCreateAgent">
            {{ t('form.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped></style>
