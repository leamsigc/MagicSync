<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 * Auto-Reply campaign manager — comment-to-DM automation (Gap 16, PRD-AUTO-REPLY).
 * Instagram-first: keyword match → private-reply DM + optional public reply,
 * tracked links, logs. Phase B: instant delivery via Meta webhooks, story-DM
 * triggers, follow-gate enforcement.
 *
 * The create/edit dialog lives in `AutoReplyCampaignForm` so the list and the
 * detail page expose the same complete set of settings. The campaign surface
 * now uses the shared collection shell (Grid / List + search / status /
 * keyword filters); every store call and modal is unchanged.
 */
import { useCollectionView } from '#layers/BaseUI/app/composables/useCollectionView'
import { useAutoReply, type AutoReplyCampaign, type AutoReplyLog, type AutoReplyStats } from '~/composables/useAutoReply'

type CampaignView = 'grid' | 'list'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const { campaigns, loading, error, fetchCampaigns, updateCampaign, deleteCampaign, fetchLogs, fetchStats, fetchWebhookStatus, subscribeWebhooks } = useAutoReply()

const showForm = ref(false)
const editing = ref<AutoReplyCampaign | null>(null)
const webhookStatus = ref<{ verifyTokenConfigured: boolean, callbackUrl: string, appIdConfigured: boolean } | null>(null)
const subscribingId = ref<string | null>(null)
const accounts = ref<Array<{ id: string, accountName: string, platform: string }>>([])
const logsOpen = ref(false)
const activeLogs = ref<AutoReplyLog[]>([])
const activeCampaign = ref<AutoReplyCampaign | null>(null)
const activeStats = ref<AutoReplyStats | null>(null)
const deletingId = ref<string | null>(null)
const deleteTarget = ref<AutoReplyCampaign | null>(null)
const deleteOpen = ref(false)

const {
  view,
  setView,
  search,
  setSearch,
  filters,
  setFilter,
  filtered,
  hasActiveFilters,
  resetFilters,
} = useCollectionView<AutoReplyCampaign>({
  key: 'app-auto-reply-campaigns',
  modes: ['grid', 'list'] satisfies CampaignView[],
  defaultView: 'grid',
  rows: campaigns,
  searchFields: campaign => [campaign.name, campaign.dmTemplate, campaign.publicReplyTemplate, ...(campaign.keywords || [])],
  filterFns: {
    enabled: (campaign, value) => String(campaign.enabled) === value,
    keyword: (campaign, value) => (campaign.keywords || []).includes(value),
  },
})

const viewOptions = computed(() => [
  { value: 'grid', label: t('view_grid'), icon: 'i-lucide-layout-grid' },
  { value: 'list', label: t('view_list'), icon: 'i-lucide-list' },
])

const statusOptions = computed(() => [
  { value: 'all', label: t('status_all') },
  { value: 'true', label: t('enabled') },
  { value: 'false', label: t('disabled') },
])

const keywordOptions = computed(() => {
  const keywords = new Set<string>()
  for (const campaign of campaigns.value) {
    for (const keyword of campaign.keywords || []) keywords.add(keyword)
  }
  return [
    { value: 'all', label: t('keyword_all') },
    ...[...keywords].sort().map(keyword => ({ value: keyword, label: keyword })),
  ]
})

const toolbarFilters = computed(() => [
  { key: 'enabled', label: t('filter_status'), value: filters.value.enabled ?? 'all', options: statusOptions.value },
  { key: 'keyword', label: t('filter_keyword'), value: filters.value.keyword ?? 'all', options: keywordOptions.value },
])

const emptyTitle = computed(() => hasActiveFilters.value ? t('no_results') : t('empty'))

function campaignRowKey(campaign: AutoReplyCampaign): string {
  return campaign.id
}

function handleViewChange(next: CampaignView) {
  setView(next)
}

function campaignMenuItems(campaign: AutoReplyCampaign) {
  return [[
    { label: t('view_details'), icon: 'i-heroicons-eye', onSelect: () => handleOpenDetail(campaign.id) },
    { label: t('edit'), icon: 'i-heroicons-pencil', onSelect: () => handleEdit(campaign) },
    { label: t('logs'), icon: 'i-heroicons-document-text', onSelect: () => handleOpenLogs(campaign) },
  ], [
    { label: t('delete'), icon: 'i-heroicons-trash', color: 'error' as const, onSelect: () => handleAskDelete(campaign) },
  ]]
}

function campaignBadges(campaign: AutoReplyCampaign) {
  return [
    { key: 'all-posts', label: t('match_all_badge'), color: 'neutral' as const, show: campaign.matchAllPosts === true },
    { key: 'story-dm', label: t('story_dm_badge'), color: 'primary' as const, show: campaign.storyDmEnabled === true },
    { key: 'follow-gate', label: t('follow_gate_badge'), color: 'warning' as const, show: campaign.followGate === true },
    { key: 'ai', label: t('ai_badge'), color: 'info' as const, show: campaign.mode === 'ai' },
  ].filter(badge => badge.show)
}

function handleOpenCreate() {
  editing.value = null
  showForm.value = true
}

function handleEdit(campaign: AutoReplyCampaign) {
  editing.value = campaign
  showForm.value = true
}

function handleOpenDetail(id: string) {
  router.push(`/app/auto-reply/${id}`)
}

function statsSummary(stats: AutoReplyStats | null): string {
  if (!stats) return ''
  return t('logs_stats', { sent: stats.sent, skipped: stats.skipped, failed: stats.failed })
}

function linkClicksText(campaign: AutoReplyCampaign): string {
  return (campaign.links || []).map(link => `${link.label}: ${link.clicks}`).join(' · ')
}

function matchModeLabel(campaign: AutoReplyCampaign): string {
  return campaign.matchMode === 'whole' ? t('whole') : t('partial')
}

async function handleToggle(campaign: AutoReplyCampaign, enabled: boolean) {
  try {
    await updateCampaign(campaign.id, { enabled })
  } catch {
    toast.add({ title: t('toggle_failed'), description: error.value || '', color: 'error' })
  }
}

function handleAskDelete(campaign: AutoReplyCampaign) {
  deleteTarget.value = campaign
  deleteOpen.value = true
}

function handleCancelDelete() {
  deleteOpen.value = false
  deleteTarget.value = null
}

async function handleConfirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  deletingId.value = target.id
  try {
    await deleteCampaign(target.id)
    toast.add({ title: t('delete_success'), color: 'success' })
    handleCancelDelete()
  } catch {
    toast.add({ title: t('delete_failed'), description: error.value || '', color: 'error' })
  } finally {
    deletingId.value = null
  }
}

async function handleOpenLogs(campaign: AutoReplyCampaign) {
  activeCampaign.value = campaign
  activeLogs.value = await fetchLogs(campaign.id, 25)
  activeStats.value = await fetchStats(campaign.id)
  logsOpen.value = true
}

async function loadAccounts() {
  try {
    const list = await $fetch<Array<{ id: string, accountName: string, platform: string }>>('/api/v1/social-accounts')
    accounts.value = (list || []).filter(account => account.platform === 'instagram')
  } catch {
    accounts.value = []
  }
}

async function loadWebhookStatus() {
  webhookStatus.value = await fetchWebhookStatus()
}

async function handleSubscribe(accountId: string) {
  subscribingId.value = accountId
  try {
    const fields = await subscribeWebhooks(accountId)
    if (fields) {
      toast.add({ title: t('subscribed'), description: fields.join(', '), color: 'success' })
    } else {
      toast.add({ title: t('subscribe_failed'), description: error.value || '', color: 'error' })
    }
  } finally {
    subscribingId.value = null
  }
}

useSeoMeta({
  title: t('title'),
  description: t('description'),
})

onMounted(async () => {
  await Promise.all([fetchCampaigns(), loadAccounts(), loadWebhookStatus()])
})
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="t('description')">
    <template #actions>
      <UButton icon="i-lucide-plus" color="primary" @click="handleOpenCreate">
        {{ t('new_campaign') }}
      </UButton>
    </template>

    <template #toolbar>
      <BaseCollectionToolbar
        :search="search"
        :search-placeholder="t('search_campaigns')"
        :filters="toolbarFilters"
        :view="view"
        :views="viewOptions"
        :busy="loading && campaigns.length === 0"
        @update:search="setSearch"
        @update:filter="setFilter"
        @update:view="handleViewChange"
      />
    </template>

    <div class="space-y-6">
      <UAlert color="neutral" variant="soft" icon="i-lucide-info" :description="t('honesty')" />

      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-webhook" class="size-4" />
            <p class="font-semibold">{{ t('webhook_title') }}</p>
            <UBadge :color="webhookStatus?.verifyTokenConfigured ? 'success' : 'warning'" variant="subtle" size="xs">
              {{ webhookStatus?.verifyTokenConfigured ? t('webhook_ready') : t('webhook_missing_token') }}
            </UBadge>
          </div>
        </template>
        <div class="space-y-3 text-sm">
          <p class="text-muted">{{ t('webhook_description') }}</p>
          <UFormField :label="t('webhook_callback')" name="callback">
            <UInput :model-value="webhookStatus?.callbackUrl || ''" readonly class="w-full font-mono text-xs" />
          </UFormField>
          <div v-if="accounts.length > 0" class="flex flex-wrap gap-2">
            <UButton
              v-for="account in accounts"
              :key="account.id"
              size="sm"
              variant="outline"
              :loading="subscribingId === account.id"
              @click="() => handleSubscribe(account.id)"
            >
              {{ t('subscribe_button') }} · {{ account.accountName }}
            </UButton>
          </div>
        </div>
      </UCard>

      <BaseCollectionGrid
        v-if="view === 'grid'"
        :items="filtered"
        :row-key="campaignRowKey"
        :loading="loading && campaigns.length === 0"
        :empty-title="emptyTitle"
        empty-icon="i-lucide-message-circle-heart"
      >
        <template #item="{ item: campaign }">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <UButton variant="link" class="h-auto truncate p-0 text-left font-semibold"
                  @click="() => handleOpenDetail(campaign.id)">
                  {{ campaign.name }}
                </UButton>
                <USwitch
                  :model-value="campaign.enabled"
                  color="primary"
                  :aria-label="campaign.name"
                  @update:model-value="(value: boolean) => handleToggle(campaign, value)"
                />
              </div>
            </template>
            <div class="space-y-2 text-sm">
              <p class="text-muted">{{ (campaign.keywords || []).join(', ') }} · {{ matchModeLabel(campaign) }}</p>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="badge in campaignBadges(campaign)" :key="badge.key" :color="badge.color" variant="subtle"
                  size="xs">
                  {{ badge.label }}
                </UBadge>
              </div>
              <p v-if="campaign.links?.length" class="text-muted">{{ t('clicks') }}: {{ linkClicksText(campaign) }}</p>
              <p class="text-xs" :class="campaign.enabled ? 'text-success' : 'text-muted'">
                {{ campaign.enabled ? t('enabled') : t('disabled') }}
              </p>
            </div>
            <template #footer>
              <div class="flex flex-wrap gap-2">
                <UButton size="sm" color="primary" icon="i-heroicons-eye" @click="() => handleOpenDetail(campaign.id)">{{ t('view_details') }}</UButton>
                <UButton size="sm" variant="soft" icon="i-heroicons-pencil" @click="() => handleEdit(campaign)">{{ t('edit') }}</UButton>
                <UButton size="sm" variant="ghost" @click="() => handleOpenLogs(campaign)">{{ t('logs') }}</UButton>
                <UButton size="sm" variant="ghost" color="error" @click="() => handleAskDelete(campaign)">{{ t('delete') }}</UButton>
              </div>
            </template>
          </UCard>
        </template>

        <template #empty>
          <UButton v-if="hasActiveFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetFilters">
            {{ t('clear_filters') }}
          </UButton>
          <UButton v-else-if="accounts.length === 0" to="/app/integrations" icon="i-lucide-plug" color="primary">
            {{ t('connect') }}
          </UButton>
        </template>
      </BaseCollectionGrid>

      <BaseCollectionList
        v-else
        :items="filtered"
        :row-key="campaignRowKey"
        :loading="loading && campaigns.length === 0"
        :empty-title="emptyTitle"
        empty-icon="i-lucide-message-circle-heart"
      >
        <template #item="{ item: campaign }">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
            <UIcon name="i-lucide-message-circle-heart" class="size-4" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <UButton variant="link" class="h-auto truncate p-0 text-left text-sm font-medium"
                @click="() => handleOpenDetail(campaign.id)">
                {{ campaign.name }}
              </UButton>
              <UBadge v-for="badge in campaignBadges(campaign)" :key="badge.key" :color="badge.color" variant="subtle"
                size="xs">
                {{ badge.label }}
              </UBadge>
              <UBadge :color="campaign.enabled ? 'success' : 'neutral'" variant="subtle" size="xs">
                {{ campaign.enabled ? t('enabled') : t('disabled') }}
              </UBadge>
            </div>
            <p class="truncate text-xs text-muted">
              {{ (campaign.keywords || []).join(', ') }} · {{ matchModeLabel(campaign) }}
            </p>
            <p v-if="campaign.links?.length" class="truncate text-xs text-muted">
              {{ t('clicks') }}: {{ linkClicksText(campaign) }}
            </p>
          </div>
          <USwitch
            class="shrink-0"
            :model-value="campaign.enabled"
            color="primary"
            :aria-label="campaign.name"
            @update:model-value="(value: boolean) => handleToggle(campaign, value)"
          />
          <UDropdownMenu :items="campaignMenuItems(campaign)" :content="{ align: 'end' }">
            <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs"
              :aria-label="t('view_details')" />
          </UDropdownMenu>
        </template>

        <template #empty>
          <UButton v-if="hasActiveFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetFilters">
            {{ t('clear_filters') }}
          </UButton>
          <UButton v-else-if="accounts.length === 0" to="/app/integrations" icon="i-lucide-plug" color="primary">
            {{ t('connect') }}
          </UButton>
        </template>
      </BaseCollectionList>
    </div>

    <AutoReplyCampaignForm v-model:open="showForm" :campaign="editing" />

    <UModal v-model:open="logsOpen" :title="t('logs')">
      <template #body>
        <p v-if="activeStats" class="mb-3 text-sm text-muted">{{ statsSummary(activeStats) }}</p>
        <p class="mb-2 text-xs text-muted">{{ activeCampaign?.name }}</p>
        <div v-if="activeLogs.length === 0" class="text-sm text-muted">{{ t('logs_empty') }}</div>
        <div v-else class="divide-y divide-default">
          <div v-for="log in activeLogs" :key="log.commentId + log.at" class="py-2 text-sm">
            <p class="font-medium">
              {{ log.authorName }}
              <span class="text-muted">· {{ log.action }} · {{ log.reason }}</span>
            </p>
            <p class="text-xs text-muted">{{ log.at }}</p>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" :title="t('delete_title')" :description="t('delete_description', { name: deleteTarget?.name || '' })">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="handleCancelDelete">{{ t('cancel') }}</UButton>
          <UButton color="error" :loading="deletingId === deleteTarget?.id" @click="handleConfirmDelete">{{ t('delete_confirm') }}</UButton>
        </div>
      </template>
    </UModal>
  </BaseCollectionPage>
</template>
