<i18n src="./agents.json"></i18n>
<script setup lang="ts">
/**
 * Agents & skills registry — shared collection shell.
 *
 * Two collections live on this page: the specialized agents (Grid / List +
 * search) and the read-only skill registry (List + search). Every fetch,
 * publish/disable/delete call and the create modal are unchanged; only the
 * surface moved to `BaseCollectionPage` and the collection components.
 */
import { useCollectionView } from '#layers/BaseUI/app/composables/useCollectionView'

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

type AgentView = 'grid' | 'list'
type BadgeTone = 'success' | 'warning' | 'error' | 'neutral'

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

const {
  view,
  setView,
  search,
  setSearch,
  filtered: filteredAgents,
  hasActiveFilters: hasAgentFilters,
  resetFilters: resetAgentFilters,
} = useCollectionView<RegistryAgent>({
  key: 'app-ai-tools-agents',
  modes: ['grid', 'list'] satisfies AgentView[],
  defaultView: 'grid',
  rows: agents,
  searchFields: agent => [
    agent.name,
    agent.description,
    agent.outputKind,
    t(`statuses.${agent.status}`),
    ...toolList(agent.allowedToolNames),
  ],
})

const {
  search: skillSearch,
  setSearch: setSkillSearch,
  filtered: filteredSkills,
  hasActiveFilters: hasSkillFilters,
  resetFilters: resetSkillFilters,
} = useCollectionView<RegistrySkill>({
  key: 'app-ai-tools-agent-skills',
  modes: ['list'],
  defaultView: 'list',
  rows: skills,
  searchFields: skill => [skill.name, skill.description, skill.sourceType, t(`statuses.${skill.status}`)],
})

const viewOptions = computed(() => [
  { value: 'grid', label: t('views.grid'), icon: 'i-lucide-layout-grid' },
  { value: 'list', label: t('views.list'), icon: 'i-lucide-list' },
])

function handleViewChange(next: AgentView) {
  setView(next)
}

function agentRowKey(agent: RegistryAgent): string {
  return agent.id
}

function skillRowKey(skill: RegistrySkill): string {
  return skill.id
}

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

function statusColor(status: string): BadgeTone {
  if (status === 'active') return 'success'
  if (status === 'draft') return 'warning'
  if (status === 'disabled') return 'error'
  return 'neutral'
}

function statusLabel(status: string): string {
  return t(`statuses.${status}`)
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

function handlePublish(agent: RegistryAgent) {
  void handleAgentAction(agent.id, 'publish')
}

function handleDisable(agent: RegistryAgent) {
  void handleAgentAction(agent.id, 'disable')
}

function handleDelete(agent: RegistryAgent) {
  void handleAgentAction(agent.id, 'delete')
}

onMounted(loadAll)
watch(activeBusinessId, () => {
  void loadAll()
})
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="t('description')">
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

    <template #toolbar>
      <BaseCollectionToolbar
        :search="search"
        :search-placeholder="t('searchAgents')"
        :view="view"
        :views="viewOptions"
        :busy="pageBusy"
        @update:search="setSearch"
        @update:view="handleViewChange"
      />
    </template>

    <div v-if="pageBusy" class="flex items-center justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="size-6 animate-spin" />
    </div>

    <template v-else>
      <section>
        <div class="mb-3">
          <h2 class="font-semibold">{{ t('agents.title') }}</h2>
          <p class="text-sm text-muted">{{ t('agents.description') }}</p>
        </div>

        <BaseCollectionGrid
          v-if="view === 'grid'"
          :items="filteredAgents"
          :row-key="agentRowKey"
          :empty-title="hasAgentFilters ? t('noResults') : t('agents.empty')"
          empty-icon="i-heroicons-cpu-chip"
        >
          <template #item="{ item: agent }">
            <BaseCollectionCard
              :title="agent.name"
              :description="agent.description || t('agents.noDescription')"
              icon="i-heroicons-cpu-chip"
              :badge="statusLabel(agent.status)"
              :badge-color="statusColor(agent.status)"
            >
              <div class="mt-2 flex flex-wrap gap-1">
                <UBadge color="neutral" variant="outline" size="xs">v{{ agent.version }}</UBadge>
                <UBadge v-if="agent.requiresHumanReview" color="warning" variant="outline" size="xs">
                  {{ t('agents.reviewRequired') }}
                </UBadge>
                <UBadge color="neutral" variant="subtle" size="xs">{{ agent.outputKind }}</UBadge>
                <UBadge v-for="tool in toolList(agent.allowedToolNames)" :key="tool" color="neutral" variant="outline"
                  size="xs">
                  {{ tool }}
                </UBadge>
              </div>

              <template #footer>
                <div class="flex flex-wrap gap-1">
                  <UButton v-if="agent.status === 'draft' || agent.status === 'disabled'" color="primary" variant="ghost"
                    size="xs" :loading="rowBusyId === agent.id" @click="() => handlePublish(agent)">
                    {{ t('actions.publish') }}
                  </UButton>
                  <UButton v-if="agent.status === 'active'" color="neutral" variant="ghost" size="xs"
                    :loading="rowBusyId === agent.id" @click="() => handleDisable(agent)">
                    {{ t('actions.disable') }}
                  </UButton>
                  <UButton v-if="agent.status !== 'active'" color="error" variant="ghost" size="xs"
                    :loading="rowBusyId === agent.id" @click="() => handleDelete(agent)">
                    {{ t('actions.delete') }}
                  </UButton>
                </div>
              </template>
            </BaseCollectionCard>
          </template>

          <template #empty>
            <UButton v-if="hasAgentFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetAgentFilters">
              {{ t('clearFilters') }}
            </UButton>
          </template>
        </BaseCollectionGrid>

        <BaseCollectionList
          v-else
          :items="filteredAgents"
          :row-key="agentRowKey"
          :empty-title="hasAgentFilters ? t('noResults') : t('agents.empty')"
          empty-icon="i-heroicons-cpu-chip"
        >
          <template #item="{ item: agent }">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
              <UIcon name="i-heroicons-cpu-chip" class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="truncate text-sm font-medium text-highlighted">{{ agent.name }}</p>
                <UBadge :color="statusColor(agent.status)" variant="subtle" size="xs">
                  {{ statusLabel(agent.status) }}
                </UBadge>
                <UBadge color="neutral" variant="outline" size="xs">v{{ agent.version }}</UBadge>
                <UBadge v-if="agent.requiresHumanReview" color="warning" variant="outline" size="xs">
                  {{ t('agents.reviewRequired') }}
                </UBadge>
              </div>
              <p class="truncate text-sm text-muted">{{ agent.description }}</p>
              <div class="mt-1 flex flex-wrap gap-1">
                <UBadge color="neutral" variant="subtle" size="xs">{{ agent.outputKind }}</UBadge>
                <UBadge v-for="tool in toolList(agent.allowedToolNames)" :key="tool" color="neutral" variant="outline"
                  size="xs">
                  {{ tool }}
                </UBadge>
              </div>
            </div>
            <div class="flex shrink-0 flex-wrap justify-end gap-1">
              <UButton v-if="agent.status === 'draft' || agent.status === 'disabled'" color="primary" variant="ghost"
                size="xs" :loading="rowBusyId === agent.id" @click="() => handlePublish(agent)">
                {{ t('actions.publish') }}
              </UButton>
              <UButton v-if="agent.status === 'active'" color="neutral" variant="ghost" size="xs"
                :loading="rowBusyId === agent.id" @click="() => handleDisable(agent)">
                {{ t('actions.disable') }}
              </UButton>
              <UButton v-if="agent.status !== 'active'" color="error" variant="ghost" size="xs"
                :loading="rowBusyId === agent.id" @click="() => handleDelete(agent)">
                {{ t('actions.delete') }}
              </UButton>
            </div>
          </template>

          <template #empty>
            <UButton v-if="hasAgentFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetAgentFilters">
              {{ t('clearFilters') }}
            </UButton>
          </template>
        </BaseCollectionList>
      </section>

      <section class="mt-10">
        <div class="mb-3">
          <h2 class="font-semibold">{{ t('skills.title') }}</h2>
          <p class="text-sm text-muted">{{ t('skills.description') }}</p>
        </div>

        <div class="mb-3">
          <BaseCollectionToolbar
            :search="skillSearch"
            :search-placeholder="t('searchSkills')"
            @update:search="setSkillSearch"
          />
        </div>

        <BaseCollectionList
          :items="filteredSkills"
          :row-key="skillRowKey"
          :empty-title="hasSkillFilters ? t('noResults') : t('skills.empty')"
          empty-icon="i-heroicons-academic-cap"
        >
          <template #item="{ item: skill }">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
              <UIcon name="i-heroicons-academic-cap" class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="truncate text-sm font-medium text-highlighted">{{ skill.name }}</p>
                <UBadge :color="statusColor(skill.status)" variant="subtle" size="xs">
                  {{ statusLabel(skill.status) }}
                </UBadge>
                <UBadge color="neutral" variant="outline" size="xs">v{{ skill.version }}</UBadge>
                <UBadge v-if="skill.sourceType === 'imported'" color="warning" variant="outline" size="xs">
                  {{ t('skills.imported') }}
                </UBadge>
                <UBadge v-if="skill.sourceType === 'built_in'" color="neutral" variant="outline" size="xs">
                  {{ t('skills.builtin') }}
                </UBadge>
              </div>
              <p class="truncate text-sm text-muted">{{ skill.description }}</p>
              <div class="mt-1 flex flex-wrap gap-1">
                <UBadge v-for="tool in toolList(skill.allowedTools)" :key="tool" color="neutral" variant="outline"
                  size="xs">
                  {{ tool }}
                </UBadge>
              </div>
            </div>
          </template>

          <template #empty>
            <UButton v-if="hasSkillFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetSkillFilters">
              {{ t('clearFilters') }}
            </UButton>
          </template>
        </BaseCollectionList>
      </section>
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
            <UInput v-model="newAgent.allowedToolNames" :placeholder="t('form.toolsPlaceholder')"
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
  </BaseCollectionPage>
</template>
