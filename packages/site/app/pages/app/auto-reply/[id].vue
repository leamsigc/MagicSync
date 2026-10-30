<i18n src="./[id].json"></i18n>
<script setup lang="ts">
import { useAutoReply, type AutoReplyCampaign, type AutoReplyLog } from '~/composables/useAutoReply'
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const campaignId = route.params.id as string

const { fetchCampaign, fetchLogs, fetchStats, updateCampaign, deleteCampaign, testMatch } = useAutoReply()

const campaign = ref<AutoReplyCampaign | null>(null)
const loading = ref(true)
const stats = ref<{ sent: number, skipped: number, failed: number, clicksPerLink: Array<{ linkId: string, label: string, target: string, clicks: number }> } | null>(null)
const logs = ref<AutoReplyLog[]>([])
const copied = ref<string | null>(null)
const toggling = ref(false)
const deleting = ref(false)
const showDelete = ref(false)
const showEdit = ref(false)
const testText = ref('')
const testResult = ref<string | null>(null)
const testRan = ref(false)
const accounts = ref<Array<{ id: string, accountName: string }>>([])

const logRows = computed<Record<string, any>[]>(() => (logs.value ?? []).map(log => ({ ...log })))

const {
  search,
  setSearch,
  filters,
  setFilter,
  filtered,
  hasActiveFilters,
  resetFilters,
} = useCollectionView<Record<string, any>>({
  key: 'auto-reply-logs',
  modes: ['table'],
  defaultView: 'table',
  rows: logRows,
  searchFields: log => [log.authorName, log.matchedKeyword, log.reason],
  filterFns: {
    action: (log, value) => log.action === value,
  },
})

const actionFilterOptions = computed(() => [
  { value: 'all', label: t('filter_all') },
  { value: 'sent', label: t('filter_sent') },
  { value: 'skipped', label: t('filter_skipped') },
  { value: 'failed', label: t('filter_failed') },
])

const toolbarFilters = computed(() => [
  {
    key: 'action',
    label: t('action'),
    value: filters.value.action || 'all',
    options: actionFilterOptions.value,
    width: 'w-full sm:w-36',
  },
])

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'time', label: t('time') },
  { key: 'author', label: t('author') },
  { key: 'keyword', label: t('keyword'), hideBelow: 'md' },
  { key: 'action', label: t('action') },
  { key: 'reason', label: t('reason'), hideBelow: 'lg' },
])

const logRowKey = (log: Record<string, any>): string => `${log.commentId}-${log.at}`

const pageTitle = computed(() => campaign.value?.name || t('seo_title'))
const pageDescription = computed(() => {
  if (!campaign.value) return t('seo_description')
  return `${t('updated', { date: formatDate(campaign.value.updatedAt) })} · ${t('created', { date: formatDate(campaign.value.createdAt) })}`
})

useSeoMeta({
  title: t('seo_title'),
  description: t('seo_description'),
})

// One "now" captured on the server and serialized to the client, so the
// relative labels hydrate identically instead of drifting with the clock.
const nowMs = useState<number>('auto-reply-relative-now', () => Date.now())

function errorMessage(error: unknown): string {
  const data = (error as { data?: { statusMessage?: string, message?: string } } | null)?.data
  return data?.statusMessage || data?.message || (error instanceof Error ? error.message : String(error))
}

function formatDate(value: string | undefined): string {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString()
  }
  catch {
    return value
  }
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString()
}

function formatRelative(at: string): string {
  const diff = nowMs.value - new Date(at).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return t('today')
  if (days === 1) return t('yesterday')
  return t('days_ago', { count: days })
}

function authorLabel(log: Record<string, any>): string {
  return log.authorName || String(log.authorId).slice(0, 6)
}

function badgeColor(action: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (action === 'sent') return 'success'
  if (action === 'skipped') return 'warning'
  if (action === 'failed') return 'error'
  return 'neutral'
}

function handleCopy(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    copied.value = text
    toast.add({ title: t('copied'), color: 'success' })
    setTimeout(() => { copied.value = null }, 1500)
  }).catch(() => {
    toast.add({ title: t('copy_failed'), color: 'error' })
  })
}

function handleEdit() {
  showEdit.value = true
}

function handleSaved(updated: AutoReplyCampaign) {
  campaign.value = updated
  showEdit.value = false
}

function handleSearchChange(value: string) {
  setSearch(value)
}

function handleFilterChange(key: string, value: string) {
  setFilter(key, value)
}

const totalClicks = computed(() => (stats.value?.clicksPerLink || []).reduce((sum, link) => sum + (link.clicks || 0), 0))
const ctr = computed(() => {
  const sent = stats.value?.sent || 0
  if (sent === 0) return 0
  return Math.round((totalClicks.value / sent) * 100)
})

const chartData = computed(() => {
  const buckets: Record<string, number> = {}
  const today = new Date()
  for (let index = 6; index >= 0; index--) {
    const date = new Date(today)
    date.setDate(today.getDate() - index)
    const key = date.toISOString().slice(0, 10)
    buckets[key] = 0
  }
  for (const item of logs.value) {
    if (item.action !== 'sent') continue
    const key = new Date(item.at).toISOString().slice(0, 10)
    if (key in buckets) buckets[key] = (buckets[key] ?? 0) + 1
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }))
})

const maxChart = computed(() => Math.max(1, ...chartData.value.map(item => item.count)))

async function handleToggle() {
  if (!campaign.value) return
  toggling.value = true
  try {
    const updated = await updateCampaign(campaign.value.id, { enabled: !campaign.value.enabled })
    campaign.value = updated
    toast.add({ title: updated.enabled ? t('toggle_enabled') : t('toggle_disabled'), color: 'success' })
  }
  catch (error) {
    toast.add({ title: errorMessage(error), color: 'error' })
  }
  finally {
    toggling.value = false
  }
}

function handleDelete() {
  showDelete.value = true
}

async function handleConfirmDelete() {
  deleting.value = true
  try {
    await deleteCampaign(campaignId)
    toast.add({ title: t('confirm_delete'), color: 'success' })
    router.push('/app/auto-reply')
  }
  catch (error) {
    toast.add({ title: errorMessage(error), color: 'error' })
  }
  finally {
    deleting.value = false
    showDelete.value = false
  }
}

function handleCancelDelete() {
  showDelete.value = false
}

async function handleTest() {
  if (!campaign.value) return
  const matched = await testMatch(campaign.value.id, testText.value, campaign.value.keywords, campaign.value.matchMode)
  testResult.value = matched
  testRan.value = true
}

async function loadAccounts() {
  try {
    const list = await $fetch<Array<{ id: string, accountName: string, platform: string }>>('/api/v1/social-accounts')
    accounts.value = (list || []).filter(item => item.platform === 'instagram').map(item => ({ id: item.id, accountName: item.accountName }))
  }
  catch {
    accounts.value = []
  }
}

function accountNameFor(id: string): string {
  return accounts.value.find(item => item.id === id)?.accountName || id
}

async function loadAll() {
  loading.value = true
  try {
    const data = await fetchCampaign(campaignId)
    campaign.value = data
    if (data) {
      const [s, l] = await Promise.all([fetchStats(data.id), fetchLogs(data.id, 100)])
      stats.value = s
      logs.value = l
    }
  }
  catch (error) {
    toast.add({ title: errorMessage(error), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadAll()
  void loadAccounts()
})
</script>

<template>
  <BaseCollectionPage :title="pageTitle" :description="pageDescription" back-to="/app/auto-reply">
    <template #actions>
      <UButton v-if="campaign" size="sm" variant="ghost" icon="i-heroicons-pencil" @click="handleEdit">{{ t('edit') }}</UButton>
      <UButton v-if="campaign" size="sm" variant="ghost" color="error" icon="i-heroicons-trash" @click="handleDelete">{{ t('delete') }}</UButton>
    </template>

    <div v-if="loading" class="flex justify-center py-16">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="!campaign" class="rounded-xl bg-muted/30 p-12 text-center" v-motion-fade :duration="200">
      <UIcon name="i-lucide-search-x" class="mx-auto h-10 w-10 text-muted-foreground" />
      <h2 class="mt-3 text-lg font-semibold">{{ t('not_found') }}</h2>
      <p class="text-sm text-muted-foreground">{{ t('not_found_description') }}</p>
      <UButton to="/app/auto-reply" color="primary" class="mt-4">{{ t('back') }}</UButton>
    </div>

    <template v-else>
      <div class="rounded-2xl border border-default bg-elevated p-5 md:p-6" v-motion-fade :duration="200">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :color="campaign.enabled ? 'success' : 'neutral'" variant="subtle">{{ campaign.enabled ? t('enabled') : t('disabled') }}</UBadge>
              <UBadge v-if="campaign.storyDmEnabled" color="primary" variant="subtle" size="xs">{{ t('story_dm') }}</UBadge>
              <UBadge v-if="campaign.followGate" color="warning" variant="subtle" size="xs">{{ t('follow_gate') }}</UBadge>
              <UBadge v-if="campaign.mode === 'ai'" color="info" variant="subtle" size="xs">{{ t('ai_mode') }}</UBadge>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span class="inline-flex items-center gap-1"><UIcon name="i-lucide-at-sign" class="size-3.5" />{{ accountNameFor(campaign.socialAccountId) }}</span>
              <span>·</span>
              <span>{{ campaign.matchMode === 'whole' ? t('whole') : t('partial') }}</span>
              <span>·</span>
              <span>{{ (campaign.keywords || []).join(', ') }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="hidden text-sm text-muted-foreground sm:inline">{{ campaign.enabled ? t('enabled') : t('disabled') }}</span>
            <USwitch :model-value="campaign.enabled" :loading="toggling" @update:model-value="handleToggle" />
          </div>
        </div>
      </div>

      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" v-motion-fade :duration="200">
        <UCard class="border-l-4 border-l-success">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-muted-foreground">{{ t('sent') }}</p>
              <p class="mt-1 text-2xl font-bold">{{ stats?.sent ?? 0 }}</p>
              <p class="text-xs text-muted-foreground">{{ t('sent_hint') }}</p>
            </div>
            <div class="rounded-xl bg-success/10 p-2.5"><UIcon name="i-lucide-send" class="size-5 text-success" /></div>
          </div>
        </UCard>
        <UCard class="border-l-4 border-l-warning">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-muted-foreground">{{ t('skipped') }}</p>
              <p class="mt-1 text-2xl font-bold">{{ stats?.skipped ?? 0 }}</p>
              <p class="text-xs text-muted-foreground">{{ t('skipped_hint') }}</p>
            </div>
            <div class="rounded-xl bg-warning/10 p-2.5"><UIcon name="i-lucide-skip-forward" class="size-5 text-warning" /></div>
          </div>
        </UCard>
        <UCard class="border-l-4 border-l-error">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-muted-foreground">{{ t('failed') }}</p>
              <p class="mt-1 text-2xl font-bold">{{ stats?.failed ?? 0 }}</p>
              <p class="text-xs text-muted-foreground">{{ t('failed_hint') }}</p>
            </div>
            <div class="rounded-xl bg-error/10 p-2.5"><UIcon name="i-lucide-alert-triangle" class="size-5 text-error" /></div>
          </div>
        </UCard>
        <UCard class="border-l-4 border-l-primary">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-muted-foreground">{{ t('clicks') }}</p>
              <p class="mt-1 text-2xl font-bold">{{ totalClicks }}</p>
              <p class="text-xs text-muted-foreground">{{ t('clicks_hint') }} · {{ ctr }}% {{ t('ctr') }}</p>
            </div>
            <div class="rounded-xl bg-primary/10 p-2.5"><UIcon name="i-lucide-mouse-pointer-click" class="size-5 text-primary" /></div>
          </div>
        </UCard>
      </div>

      <div class="mt-6 grid gap-4 lg:grid-cols-3">
        <UCard class="lg:col-span-2" v-motion-fade :duration="220">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-semibold">{{ t('chart_title') }}</h3>
              <span class="text-xs text-muted-foreground">{{ t('funnel_sent') }} · {{ t('funnel_clicked') }}</span>
            </div>
          </template>
          <div v-if="chartData.every(item => item.count === 0)" class="py-8 text-center text-sm text-muted-foreground">{{ t('chart_empty') }}</div>
          <div v-else class="flex h-28 items-end gap-1.5">
            <div v-for="item in chartData" :key="item.date" class="flex flex-1 flex-col items-center gap-1">
              <div class="w-full rounded-t-md bg-primary transition-all" :style="{ height: `${(item.count / maxChart) * 80 + 8}px`, opacity: item.count ? 1 : 0.15 }" />
              <span class="text-[10px] text-muted-foreground">{{ item.date.slice(5) }}</span>
              <span class="text-[11px] font-medium">{{ item.count }}</span>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2 text-xs">
            <UBadge variant="subtle" color="primary">{{ t('funnel_sent') }}: {{ stats?.sent ?? 0 }}</UBadge>
            <UBadge variant="subtle" color="success">{{ t('funnel_clicked') }}: {{ totalClicks }}</UBadge>
            <UBadge variant="subtle" color="neutral">{{ t('ctr') }} {{ ctr }}%</UBadge>
          </div>
        </UCard>

        <UCard v-motion-fade :duration="220">
          <template #header><h3 class="font-semibold">{{ t('links_performance') }}</h3></template>
          <div v-if="!stats?.clicksPerLink?.length" class="py-6 text-center text-sm text-muted-foreground">{{ t('no_links') }}</div>
          <div v-else class="space-y-3">
            <div v-for="link in stats.clicksPerLink" :key="link.linkId" class="rounded-xl border border-default p-3">
              <div class="flex items-center justify-between gap-2">
                <p class="truncate text-sm font-medium">{{ link.label }}</p>
                <UBadge :color="link.clicks ? 'success' : 'neutral'" variant="subtle" size="xs">{{ link.clicks }} {{ t('clicks') }}</UBadge>
              </div>
              <p class="truncate text-xs text-muted-foreground">{{ link.target }}</p>
              <div class="mt-2 flex items-center gap-2">
                <UInput :model-value="`/r/${campaign.id}/${link.linkId}`" readonly size="xs" class="flex-1 font-mono text-xs" />
                <UButton size="xs" variant="ghost" :icon="copied === `/r/${campaign.id}/${link.linkId}` ? 'i-heroicons-check' : 'i-heroicons-clipboard'" @click="() => handleCopy(`/r/${campaign.id}/${link.linkId}`)">{{ t('copy') }}</UButton>
                <UButton size="xs" variant="ghost" icon="i-heroicons-arrow-top-right-on-square" :to="link.target" target="_blank">{{ t('open') }}</UButton>
              </div>
              <UProgress :model-value="stats?.sent ? Math.min(100, Math.round((link.clicks / (stats.sent || 1)) * 100)) : 0" class="mt-2" size="xs" />
            </div>
          </div>
        </UCard>
      </div>

      <div class="mt-6 grid gap-4 lg:grid-cols-2">
        <UCard v-motion-fade :duration="200">
          <template #header><h3 class="font-semibold">{{ t('targeting') }}</h3></template>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between"><span class="text-muted-foreground">{{ t('account') }}</span><span class="font-medium">{{ accountNameFor(campaign.socialAccountId) }}</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">{{ t('watching') }}</span><span class="max-w-[60%] text-right font-medium">{{ campaign.matchAllPosts ? t('watching_all') : t('posts', { count: (campaign.externalPostIds || []).length }) }}</span></div>
            <div v-if="!campaign.matchAllPosts" class="rounded-lg bg-muted p-2 font-mono text-xs break-all">{{ campaign.externalPostIds.join(', ') || '—' }}</div>
            <div class="flex flex-wrap gap-1.5">
              <UBadge v-for="kw in campaign.keywords" :key="kw" variant="subtle" color="primary">{{ kw }}</UBadge>
            </div>
            <div class="flex justify-between"><span class="text-muted-foreground">{{ t('match_mode') }}</span><UBadge variant="subtle" color="neutral">{{ campaign.matchMode === 'whole' ? t('whole') : t('partial') }}</UBadge></div>
          </div>
        </UCard>
        <UCard v-motion-fade :duration="200">
          <template #header><h3 class="font-semibold">{{ t('messaging') }}</h3></template>
          <div class="space-y-3 text-sm">
            <div>
              <p class="text-xs text-muted-foreground">{{ t('dm_template') }}</p>
              <p class="mt-1 whitespace-pre-wrap rounded-lg bg-muted p-2.5 font-mono text-xs">{{ campaign.dmTemplate }}</p>
            </div>
            <div v-if="campaign.publicReplyTemplate">
              <p class="text-xs text-muted-foreground">{{ t('public_reply') }}</p>
              <p class="mt-1 rounded-lg bg-muted p-2 text-xs">{{ campaign.publicReplyTemplate }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <UBadge :color="campaign.storyDmEnabled ? 'success' : 'neutral'" variant="subtle" size="xs">{{ t('story_dm') }}: {{ campaign.storyDmEnabled ? t('yes') : t('no') }}</UBadge>
              <UBadge :color="campaign.followGate ? 'warning' : 'neutral'" variant="subtle" size="xs">{{ t('follow_gate') }}: {{ campaign.followGate ? t('yes') : t('no') }}</UBadge>
              <UBadge :color="campaign.mode === 'ai' ? 'info' : 'neutral'" variant="subtle" size="xs">{{ t('ai_mode') }}: {{ campaign.mode === 'ai' ? t('yes') : t('no') }}</UBadge>
            </div>
            <div v-if="campaign.followGate && campaign.followPromptTemplate" class="rounded-lg bg-amber-50 p-2 text-xs dark:bg-amber-950/30">{{ campaign.followPromptTemplate }}</div>
          </div>
        </UCard>
      </div>

      <UCard class="mt-6" v-motion-fade :duration="200">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-semibold">{{ t('preview_dm') }}</h3>
            <UBadge variant="subtle" color="neutral" size="xs">{{ t('honesty') }}</UBadge>
          </div>
        </template>
        <div class="space-y-3">
          <UInput v-model="testText" :placeholder="t('test_placeholder')" class="w-full" />
          <div class="flex gap-2">
            <UButton size="sm" variant="outline" @click="handleTest">{{ t('test_button') }}</UButton>
            <span v-if="testRan" class="text-sm"><span class="text-muted-foreground">{{ t('matched') }}:</span> <UBadge :color="testResult ? 'success' : 'neutral'" variant="subtle">{{ testResult || t('no_match') }}</UBadge></span>
          </div>
          <div class="rounded-xl border border-dashed bg-muted/30 p-3">
            <p class="text-xs text-muted-foreground">{{ t('preview_with', { username: 'alex' }) }}</p>
            <p class="mt-1 whitespace-pre-wrap text-sm">{{ (campaign.dmTemplate || '').replaceAll('{username}', 'alex').replaceAll('{link1}', `/r/${campaign.id}/link1`).replaceAll('{link2}', `/r/${campaign.id}/link2`) }}</p>
          </div>
        </div>
      </UCard>

      <UCard id="logs-section" class="mt-6" v-motion-fade :duration="200">
        <template #header>
          <div>
            <h3 class="font-semibold">{{ t('logs') }}</h3>
            <p class="text-xs text-muted-foreground">{{ t('logs_description') }}</p>
          </div>
        </template>

        <BaseCollectionToolbar
          class="mb-4"
          :search="search"
          :search-placeholder="t('search_logs')"
          :filters="toolbarFilters"
          @update:search="handleSearchChange"
          @update:filter="handleFilterChange"
        />

        <BaseDataTable
          :rows="filtered"
          :columns="columns"
          :row-key="logRowKey"
          min-width="42rem"
        >
          <template #cell-time="{ row }">
            <span class="whitespace-nowrap text-xs">
              <span class="font-mono">{{ formatRelative(row.at) }}</span>
              <ClientOnly>
                <span class="ml-1 hidden text-muted-foreground md:inline">{{ formatTime(row.at) }}</span>
              </ClientOnly>
            </span>
          </template>

          <template #cell-author="{ row }">
            <span class="font-medium">{{ authorLabel(row) }}</span>
          </template>

          <template #cell-keyword="{ row }">
            <UBadge v-if="row.matchedKeyword" variant="subtle" size="xs">{{ row.matchedKeyword }}</UBadge>
            <span v-else class="text-muted-foreground">—</span>
          </template>

          <template #cell-action="{ row }">
            <UBadge :color="badgeColor(row.action)" variant="subtle" size="xs">{{ row.action }}</UBadge>
          </template>

          <template #cell-reason="{ row }">
            <span class="block max-w-[220px] truncate text-xs" :title="row.reason">{{ row.reason }}</span>
          </template>

          <template #empty>
            <div class="py-8 text-center">
              <UIcon name="i-lucide-history" class="mx-auto mb-3 size-9 text-dimmed" />
              <p class="text-sm text-muted">{{ logs.length === 0 ? t('no_logs') : t('no_logs_filtered') }}</p>
              <UButton
                v-if="hasActiveFilters"
                class="mt-3"
                variant="ghost"
                size="sm"
                icon="i-lucide-filter-x"
                :label="t('clear_filters')"
                @click="resetFilters"
              />
            </div>
          </template>
        </BaseDataTable>
      </UCard>

      <AutoReplyCampaignForm v-model:open="showEdit" :campaign="campaign" @saved="handleSaved" />

      <UModal v-model:open="showDelete" :title="t('confirm_delete_title')" :description="t('confirm_delete_description')">
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="handleCancelDelete">{{ t('cancel') }}</UButton>
            <UButton color="error" :loading="deleting" @click="handleConfirmDelete">{{ t('confirm_delete') }}</UButton>
          </div>
        </template>
      </UModal>
    </template>
  </BaseCollectionPage>
</template>
