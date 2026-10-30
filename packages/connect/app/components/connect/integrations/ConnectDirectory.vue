<!-- Translation file -->
<i18n src="#site/app/pages/app/integrations/connect.json"></i18n>

<script lang="ts" setup>
/**
 * Integrations directory with Grid, List and Table views for connected
 * providers, built on the shared collection shell (`BaseCollectionToolbar`,
 * `useCollectionView`, `BaseCollectionList`, `BaseDataTable`).
 *
 * The grid keeps the rich `ConnectIntegrationCard` (health, reconnect banner,
 * pages menu); list and table are compact renderings with the same actions.
 */
import type { ConnectDirectoryItem, IntegrationSort, IntegrationView } from '#layers/BaseConnect/app/composables/connect/integrations/useIntegrationDirectory'
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'
import { useConnectionManager } from '#layers/BaseConnect/app/composables/connect/integrations/useConnectionManager'
import { useIntegrationDirectory } from '#layers/BaseConnect/app/composables/connect/integrations/useIntegrationDirectory'
import ConnectIntegrationCard from './ConnectIntegrationCard.vue'
import ConnectPagesModal from './ConnectPagesModal.vue'

const props = defineProps<{
  connections: ConnectDirectoryItem[]
}>()

const { t, HandleReconnect, handleDisconnect } = useConnectionManager()
const {
  healthStatus,
  statusTone,
  statusLabel,
  formattedDate,
  timeAgo,
} = useIntegrationDirectory()

const pagesTarget = ref<ConnectDirectoryItem | null>(null)
const pagesModalOpen = ref(false)

const rows = computed(() => props.connections)

const {
  view,
  setView,
  search,
  setSearch,
  filters,
  setFilter,
  sort,
  setSort,
  filtered,
} = useCollectionView<ConnectDirectoryItem>({
  key: 'app-integrations',
  modes: ['grid', 'list', 'table'] satisfies IntegrationView[],
  defaultView: 'grid',
  rows,
  searchFields: item => [item.name, item.platform],
  filterFns: {
    status: (item, value) => healthStatus(item.health) === value,
  },
  sorters: {
    recent: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    name: (a, b) => a.name.localeCompare(b.name),
    platform: (a, b) => String(a.platform || '').localeCompare(String(b.platform || '')),
  },
  initialSort: 'recent' satisfies IntegrationSort,
})

const statusOptions = computed(() => [
  { value: 'all', label: t('directory.all_statuses') },
  { value: 'healthy', label: t('directory.status_healthy') },
  { value: 'expiring_soon', label: t('directory.status_expiring') },
  { value: 'expired', label: t('directory.status_expired') },
])

const sortOptions = computed(() => [
  { value: 'recent', label: t('directory.sort_recent') },
  { value: 'name', label: t('directory.sort_name') },
  { value: 'platform', label: t('directory.sort_platform') },
])

const viewOptions = computed(() => [
  { value: 'grid', label: t('directory.view_grid'), icon: 'i-lucide-layout-grid' },
  { value: 'list', label: t('directory.view_list'), icon: 'i-lucide-list' },
  { value: 'table', label: t('directory.view_table'), icon: 'i-lucide-table' },
])

const toolbarFilters = computed(() => [
  { key: 'status', label: t('directory.all_statuses'), value: filters.value.status || 'all', options: statusOptions.value, width: 'w-full sm:w-44' },
])

const toolbarSort = computed(() => ({ value: sort.value, options: sortOptions.value }))

const columns: CollectionTableColumn[] = [
  { key: 'provider', label: t('directory.columns.provider') },
  { key: 'status', label: t('directory.columns.status') },
  { key: 'platform', label: t('directory.columns.platform'), hideBelow: 'md' },
  { key: 'connected', label: t('directory.columns.connected'), hideBelow: 'lg' },
  { key: 'activity', label: t('directory.columns.activity'), hideBelow: 'xl' },
]

const rowKey = (item: ConnectDirectoryItem): string => item.id

function reconnect(item: ConnectDirectoryItem) {
  HandleReconnect(item.accountId || item.id, item.platform || item.name)
}

function disconnect(item: ConnectDirectoryItem) {
  handleDisconnect(item.id)
}

function openPages(item: ConnectDirectoryItem) {
  pagesTarget.value = item
  pagesModalOpen.value = true
}

function menuItems(item: ConnectDirectoryItem) {
  return [[
    { label: t('menu.pages'), icon: 'i-heroicons-viewfinder-circle', onSelect: () => openPages(item) },
    { label: t('menu.reconnect'), icon: 'i-heroicons-arrow-path', onSelect: () => reconnect(item) },
    { label: t('menu.disconnect'), icon: 'i-heroicons-link-slash', color: 'error' as const, onSelect: () => disconnect(item) },
  ]]
}
</script>

<template>
  <div class="space-y-4">
    <BaseCollectionToolbar
      :search="search"
      :search-placeholder="t('directory.search')"
      :filters="toolbarFilters"
      :sort="toolbarSort"
      :view="view"
      :views="viewOptions"
      @update:search="setSearch"
      @update:filter="(key: string, value: string) => setFilter(key, value)"
      @update:sort="setSort"
      @update:view="(next: IntegrationView) => setView(next)"
    />

    <BaseCollectionGrid
      v-if="view === 'grid'"
      :items="filtered"
      :row-key="rowKey"
      :empty-title="t('directory.empty')"
      empty-icon="i-lucide-plug-zap"
      :columns="4"
    >
      <template #item="{ item }">
        <ConnectIntegrationCard
          :id="item.id"
          :name="item.name"
          :image="item.image || ''"
          :icon="item.icon"
          :tags="item.tags || []"
          :time="formattedDate(item.createdAt)"
          :connected="item.connected"
          :health="item.health"
          :platform="item.platform"
          :account-id="item.accountId"
          :show-edit="false"
        />
      </template>
    </BaseCollectionGrid>

    <BaseCollectionList
      v-else-if="view === 'list'"
      :items="filtered"
      :row-key="rowKey"
      :empty-title="t('directory.empty')"
      empty-icon="i-lucide-plug-zap"
    >
      <template #item="{ item }">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
          <UIcon :name="item.icon" class="size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium capitalize text-highlighted">{{ item.name }}</p>
          <p class="truncate text-sm text-muted">{{ formattedDate(item.createdAt) }}</p>
        </div>
        <UBadge class="hidden shrink-0 sm:inline-flex" :color="statusTone(item)" variant="subtle" size="sm">
          {{ statusLabel(item) }}
        </UBadge>
        <span class="hidden w-32 whitespace-nowrap text-right text-xs text-muted lg:block">{{ timeAgo(item.createdAt) }}</span>
        <UDropdownMenu :items="menuItems(item)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs" :aria-label="t('directory.actions')" />
        </UDropdownMenu>
      </template>
    </BaseCollectionList>

    <BaseDataTable
      v-else
      :rows="filtered"
      :columns="columns"
      :row-key="rowKey"
      :empty-title="t('directory.empty')"
      empty-icon="i-lucide-plug-zap"
    >
      <template #cell-provider="{ row }">
        <div class="flex items-center gap-3">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-elevated">
            <UIcon :name="row.icon" class="size-5" />
          </span>
          <span class="truncate font-medium capitalize text-highlighted">{{ row.name }}</span>
        </div>
      </template>
      <template #cell-status="{ row }">
        <UBadge :color="statusTone(row)" variant="subtle" size="sm">{{ statusLabel(row) }}</UBadge>
      </template>
      <template #cell-platform="{ row }">
        <span class="capitalize text-muted">{{ row.platform || '—' }}</span>
      </template>
      <template #cell-connected="{ row }">
        <span class="whitespace-nowrap text-muted">{{ formattedDate(row.createdAt) }}</span>
      </template>
      <template #cell-activity="{ row }">
        <span class="whitespace-nowrap text-muted">{{ timeAgo(row.createdAt) }}</span>
      </template>
      <template #row-actions="{ row }">
        <UDropdownMenu :items="menuItems(row)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs" :aria-label="t('directory.actions')" />
        </UDropdownMenu>
      </template>
    </BaseDataTable>

    <ConnectPagesModal v-model:open="pagesModalOpen" :platform="pagesTarget?.platform" :name="pagesTarget?.name" />
  </div>
</template>

<style scoped></style>
