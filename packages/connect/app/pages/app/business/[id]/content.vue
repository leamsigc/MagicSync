<i18n src="./content.json"></i18n>
<script setup lang="ts">
import BoardColumn from './components/BoardColumn.vue'
import BatchIdeasModal from './components/BatchIdeasModal.vue'
import CreateCardModal from './components/CreateCardModal.vue'
import CardDetailDrawer from './components/CardDetailDrawer.vue'
import { BOARD_COLUMNS, COMMON_PLATFORMS, type BoardDetail, type BoardItem } from './components/board-types'

interface AgentRunRow {
  id: string
  agentName: string
  status: string
  tokensUsed: number
  durationMs: number | null
  toolEvents: string
  summary: string
  startedAt: string
}

const BATCH_POLL_INTERVAL_MS = 4000
const BATCH_POLL_TIMEOUT_MS = 5 * 60 * 1000

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const businessId = route.params.id as string

const items = ref<BoardItem[]>([])
const loading = ref(true)
const mounted = ref(false)
const creating = ref(false)
const createOpen = ref(false)
const busyItem = ref<{ id: string, action: string } | null>(null)
const search = ref('')
const platformFilter = ref('all')
const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref<BoardDetail | null>(null)
const batchOpen = ref(false)
const batching = ref(false)
const scanning = ref(false)
const dragItem = ref<BoardItem | null>(null)
const deleteOpen = ref(false)
const pendingDelete = ref<BoardItem | null>(null)
const deleting = ref(false)
const runs = ref<AgentRunRow[]>([])
const runsLoading = ref(false)

useHead({
  title: t('seo_title'),
  meta: [{ name: 'description', content: t('seo_description') }],
})

const platformOptions = computed(() => {
  const used = new Set<string>()
  for (const item of items.value) {
    for (const platform of item.platforms ?? []) used.add(platform)
  }
  return Array.from(new Set([...used, ...COMMON_PLATFORMS]))
})

const platformFilterItems = computed(() => [
  { label: t('filters.allPlatforms'), value: 'all' },
  ...platformOptions.value.map(platform => ({ label: platform, value: platform })),
])

const filteredItems = computed(() => items.value.filter(matchesFilters))
const hasAnyItems = computed(() => items.value.length > 0)

function matchesFilters(item: BoardItem): boolean {
  const term = search.value.trim().toLowerCase()
  if (term && !`${item.title} ${item.brief}`.toLowerCase().includes(term)) return false
  if (platformFilter.value !== 'all' && !(item.platforms ?? []).includes(platformFilter.value)) return false
  return true
}

function errorMessage(error: unknown): string {
  const data = (error as { data?: { statusMessage?: string, message?: string } } | null)?.data
  return data?.statusMessage || data?.message || (error instanceof Error ? error.message : String(error))
}

async function fetchItems() {
  loading.value = true
  try {
    const response = await $fetch<{ items: BoardItem[] }>('/api/v1/content-items', { query: { businessId } })
    items.value = response.items
  }
  catch (error) {
    toast.add({ title: t('feedback.loadFailed'), description: errorMessage(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    loading.value = false
  }
}

function upsertItem(item: BoardItem) {
  const index = items.value.findIndex(row => row.id === item.id)
  if (index === -1) items.value.unshift(item)
  else items.value[index] = item
}

async function handleCreate(payload: { title: string, brief: string, platforms: string[] }) {
  creating.value = true
  try {
    const response = await $fetch<{ item: BoardItem }>('/api/v1/content-items', {
      method: 'POST',
      body: { businessId, ...payload },
    })
    upsertItem(response.item)
    createOpen.value = false
    toast.add({ title: t('feedback.created'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('feedback.actionFailed', { error: errorMessage(error) }), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    creating.value = false
  }
}

async function handleAction(item: BoardItem, action: string) {
  busyItem.value = { id: item.id, action }
  try {
    const response = await $fetch<{ item: BoardItem }>(`/api/v1/content-items/${item.id}/actions`, {
      method: 'POST',
      body: { businessId, action },
    })
    upsertItem(response.item)
    if (detail.value?.item.id === response.item.id) {
      detail.value = { ...detail.value, item: response.item }
    }
    toast.add({
      title: t('feedback.moved', { state: t(`states.${response.item.state}`) }),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  }
  catch (error) {
    toast.add({ title: t('feedback.actionFailed', { error: errorMessage(error) }), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyItem.value = null
  }
}

async function handleOpenDetail(item: BoardItem) {
  detailOpen.value = true
  detailLoading.value = true
  try {
    detail.value = await $fetch<BoardDetail>(`/api/v1/content-items/${item.id}`, { query: { businessId } })
  }
  catch (error) {
    detail.value = null
    toast.add({ title: t('feedback.detailFailed'), description: errorMessage(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    detailLoading.value = false
  }
}

async function fetchRuns() {
  runsLoading.value = true
  try {
    const response = await $fetch<{ runs: AgentRunRow[] }>('/api/v1/agent/runs', { query: { businessId } })
    runs.value = response.runs
  }
  catch {
    runs.value = []
  }
  finally {
    runsLoading.value = false
  }
}

async function handleBatch(payload: { kind: string, days: number, platforms: string[], topic: string }) {
  batching.value = true
  try {
    const response = await $fetch<{ runId: string, count: number, status: string }>('/api/v1/content-items/batch', {
      method: 'POST',
      body: { businessId, ...payload },
    })
    batchOpen.value = false
    toast.add({ title: t('batch.started', { count: response.count }), icon: 'i-heroicons-sparkles', color: 'success' })
    await pollBatchRun(response.runId)
  }
  catch (error) {
    toast.add({ title: t('batch.failed', { error: errorMessage(error) }), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    batching.value = false
  }
}

async function pollBatchRun(runId: string) {
  const before = new Set(items.value.map(item => item.id))
  const started = Date.now()
  while (Date.now() - started < BATCH_POLL_TIMEOUT_MS) {
    await new Promise(resolve => setTimeout(resolve, BATCH_POLL_INTERVAL_MS))
    await fetchRuns()
    const run = runs.value.find(row => row.id === runId)
    if (run && run.status !== 'running') {
      await fetchItems()
      if (run.status === 'completed') {
        const created = items.value.filter(item => !before.has(item.id)).length
        toast.add({ title: t('batch.created', { count: created }), icon: 'i-heroicons-check-circle', color: 'success' })
      }
      else {
        toast.add({ title: t('batch.failed', { error: run.summary || run.status }), icon: 'i-heroicons-x-circle', color: 'error' })
      }
      return
    }
  }
  await fetchItems()
  await fetchRuns()
}

function handleOpenCreate() {
  createOpen.value = true
}

function handleOpenBatch() {
  batchOpen.value = true
}

async function handleIdeaScan() {
  scanning.value = true
  try {
    const response = await $fetch<{ items: BoardItem[], created: number }>('/api/v1/content-items/idea-scan', {
      method: 'POST',
      body: { businessId, count: 15 },
    })
    items.value = [...response.items, ...items.value]
    toast.add({ title: t('ideascan.created', { count: response.created }), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('ideascan.failed', { error: errorMessage(error) }), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    scanning.value = false
  }
}

function handleClearFilters() {
  search.value = ''
  platformFilter.value = 'all'
}

function handlePickup(item: BoardItem) {
  dragItem.value = item
}

function handleRelease() {
  dragItem.value = null
}

function handleInvalidDrop() {
  toast.add({ title: t('dnd.invalid'), icon: 'i-heroicons-x-circle', color: 'error' })
}

function handleAskRemove(item: BoardItem) {
  pendingDelete.value = item
  deleteOpen.value = true
}

function handleCancelRemove() {
  deleteOpen.value = false
  pendingDelete.value = null
}

async function handleConfirmRemove() {
  const target = pendingDelete.value
  if (!target) return
  deleting.value = true
  try {
    await $fetch(`/api/v1/content-items/${target.id}`, {
      method: 'DELETE',
      query: { businessId },
    })
    items.value = items.value.filter(row => row.id !== target.id)
    deleteOpen.value = false
    pendingDelete.value = null
    toast.add({ title: t('delete.deleted'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('delete.failed', { error: errorMessage(error) }), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    deleting.value = false
  }
}

function handleBack() {
  router.push('/app/business')
}

function handleOpenChat(item: BoardItem) {
  router.push({ path: '/app/chat', query: { businessId, cardId: item.id } })
}

function handleBriefSaved(item: BoardItem) {
  upsertItem(item)
  if (detail.value) detail.value = { ...detail.value, item }
}

function handleImproved(item: BoardItem) {
  upsertItem(item)
  void handleOpenDetail(item)
}

onMounted(() => {
  mounted.value = true
  void fetchItems()
  void fetchRuns()
})
</script>

<template>
  <div class="min-h-screen ">
    <header class="sticky top-0 z-40 border-b border-white/5  backdrop-blur-xl">
      <div class="mx-auto p-2 lg:p-6 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <UButton variant="ghost" color="neutral" icon="i-heroicons-arrow-left" @click="handleBack"
            class="text-white/50 hover:text-white" />
          <div>
            <h1 class="text-lg font-semibold text-white/90">{{ t('title') }}</h1>
            <p class="text-xs text-white/40">{{ t('description') }}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton icon="i-heroicons-plus" color="primary" data-testid="board-create" @click="handleOpenCreate">
            {{ t('actions.create') }}
          </UButton>
          <UButton icon="i-heroicons-rectangle-stack" variant="outline" color="neutral" data-testid="board-batch"
            @click="handleOpenBatch" class="border-white/10 text-white/50">
            {{ t('batch.button') }}
          </UButton>
          <UButton variant="outline" color="neutral" icon="i-heroicons-arrow-path" :loading="loading && mounted"
            @click="fetchItems" class="border-white/10 text-white/50">
            {{ t('actions.refresh') }}
          </UButton>
        </div>
      </div>
    </header>

    <main class="mx-auto p-2 lg:p-6 space-y-6">
      <div v-if="loading && !hasAnyItems" class="flex items-center justify-center py-20">
        <UIcon name="i-heroicons-arrow-path" class="size-6 animate-spin text-white/30" />
      </div>

      <template v-else-if="hasAnyItems">
        <div v-motion-fade :duration="200" class="flex flex-wrap items-center gap-3">
          <UInput v-model="search" icon="i-heroicons-magnifying-glass" :placeholder="t('filters.search')"
            class="w-full sm:w-72" data-testid="board-search" />
          <USelect v-model="platformFilter" :items="platformFilterItems" class="w-full sm:w-48"
            data-testid="board-platform-filter" />
          <UButton v-if="search || platformFilter !== 'all'" size="sm" variant="ghost" color="neutral"
            @click="handleClearFilters" class="text-white/40">
            {{ t('filters.clear') }}
          </UButton>
          <span class="ms-auto text-xs text-white/30">{{ t('filters.count', { count: filteredItems.length }) }}</span>
        </div>

        <div class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 mt-4" data-testid="board-columns">
          <BoardColumn v-for="column in BOARD_COLUMNS" :key="column.key" :column="column" :items="filteredItems"
            :busy-id="busyItem?.id ?? null" :drag-item="dragItem" @open="handleOpenDetail" @action="handleAction"
            @remove="handleAskRemove" @pickup="handlePickup" @release="handleRelease"
            @dropinvalid="handleInvalidDrop" />
        </div>
      </template>

      <UCard v-else v-motion-fade-visible :duration="250" class="text-center border border-white/5 bg-[#111111]">
        <div class="flex flex-col items-center gap-3 py-16">
          <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <UIcon name="i-heroicons-clipboard-document-list" class="size-8 text-primary" />
          </div>
          <h2 class="text-xl font-semibold text-white/90">{{ t('empty.title') }}</h2>
          <p class="max-w-md text-sm text-white/40">{{ t('empty.description') }}</p>
          <div class="flex flex-wrap justify-center gap-2">
            <UButton icon="i-heroicons-sparkles" color="primary" :loading="scanning" data-testid="board-empty-scan"
              @click="handleIdeaScan">
              {{ t('empty.scanCta') }}
            </UButton>
            <UButton icon="i-heroicons-plus" variant="outline" color="neutral" data-testid="board-empty-create"
              @click="handleOpenCreate">
              {{ t('empty.cta') }}
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard v-motion-fade-visible :duration="250" class="border border-white/5 bg-[#111111]">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-white/70">{{ t('activity.title') }}</h2>
            <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-arrow-path" :loading="runsLoading"
              @click="fetchRuns" class="text-white/30" />
          </div>
        </template>
        <p v-if="runs.length === 0" class="text-xs text-white/30">{{ t('activity.empty') }}</p>
        <ul v-else class="space-y-2">
          <li v-for="run in runs.slice(0, 8)" :key="run.id" class="flex flex-wrap items-center gap-2 text-xs">
            <UBadge :color="run.status === 'completed' ? 'success' : run.status === 'failed' ? 'error' : 'neutral'"
              variant="subtle" size="xs">
              {{ run.status }}
            </UBadge>
            <span class="font-medium text-white/60">{{ run.agentName }}</span>
            <span class="text-white/30">{{ run.durationMs ?? 0 }} ms</span>
            <span class="text-white/30">{{ run.tokensUsed }} tokens</span>
          </li>
        </ul>
      </UCard>

      <CreateCardModal v-model:open="createOpen" :saving="creating" @submit="handleCreate" />
      <BatchIdeasModal v-model:open="batchOpen" :saving="batching" @submit="handleBatch" />
      <UModal v-model:open="deleteOpen" :title="t('delete.title')" :description="t('delete.description')">
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="handleCancelRemove">
              {{ t('delete.cancel') }}
            </UButton>
            <UButton color="error" :loading="deleting" @click="handleConfirmRemove">
              {{ t('delete.confirm') }}
            </UButton>
          </div>
        </template>
      </UModal>
      <CardDetailDrawer v-model:open="detailOpen" :detail="detail" :business-id="businessId" :loading="detailLoading"
        :busy-action="busyItem?.action ?? null" @action="handleAction" @open-chat="handleOpenChat"
        @brief-saved="handleBriefSaved" @improved="handleImproved" />
    </main>
  </div>
</template>
