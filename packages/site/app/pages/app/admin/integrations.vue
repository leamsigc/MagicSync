<i18n src="./integrations.json"></i18n>

<script lang="ts" setup>
/**
 * Admin → Integrations.
 *
 * Every connected platform account, read-only, in the shared collection shell.
 * `useCollectionView` owns search / provider filter / sort; grid, list and
 * table all render the same `filtered` rows.
 */
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'

definePageMeta({
  layout: 'dashboard-layout',
})

interface AdminConnection {
  id: string
  providerId: string
  accountId: string
  createdAt: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

/** Brand names are proper nouns, so only the two compound labels are copy. */
const BRAND_LABELS: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  discord: 'Discord',
  reddit: 'Reddit',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  twitter: 'Twitter / X',
  youtube: 'YouTube',
  threads: 'Threads',
  dribbble: 'Dribbble',
  instagram: 'Instagram',
  wordpress: 'WordPress',
  canva: 'Canva',
}

const PLATFORM_ICONS: Record<string, string> = {
  google: 'lucide:search',
  facebook: 'lucide:facebook',
  twitter: 'lucide:twitter',
  linkedin: 'lucide:linkedin',
  instagram: 'lucide:instagram',
  youtube: 'lucide:youtube',
  tiktok: 'lucide:music',
  threads: 'lucide:message-circle',
  discord: 'lucide:message-square',
  reddit: 'lucide:message-circle',
  dribbble: 'lucide:basketball',
  wordpress: 'lucide:globe',
  canva: 'lucide:palette',
}

const { t } = useI18n()
const toast = useToast()

const connections = ref<AdminConnection[]>([])
const loading = ref(true)

function providerLabel(providerId: string): string {
  if (providerId === 'linkedin-page') return t('providers.linkedinPage')
  if (providerId === 'email-password') return t('providers.emailPassword')
  return BRAND_LABELS[providerId] ?? providerId
}

function providerIcon(providerId: string): string {
  return PLATFORM_ICONS[providerId] ?? 'lucide:plug'
}

function userName(connection: AdminConnection): string {
  return connection.userName || t('unnamed')
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

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
  hasActiveFilters,
  resetFilters,
} = useCollectionView<AdminConnection>({
  key: 'admin-integrations',
  modes: ['grid', 'list', 'table'],
  defaultView: 'grid',
  rows: connections,
  searchFields: connection => [
    providerLabel(connection.providerId),
    connection.providerId,
    connection.accountId,
    connection.userName,
    connection.userEmail,
  ],
  filterFns: {
    provider: (connection, value) => connection.providerId === value,
  },
  sorters: {
    recent: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    oldest: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    provider: (a, b) => providerLabel(a.providerId).localeCompare(providerLabel(b.providerId)),
    user: (a, b) => userName(a).localeCompare(userName(b)),
  },
  initialSort: 'recent',
})

const rowKey = (connection: AdminConnection): string => connection.id

const providerOptions = computed(() => {
  const ids = new Set(connections.value.map(connection => connection.providerId))
  const options = [...ids]
    .sort((a, b) => providerLabel(a).localeCompare(providerLabel(b)))
    .map(id => ({ value: id, label: providerLabel(id) }))
  return [{ value: 'all', label: t('filters.allProviders') }, ...options]
})

const sortOptions = computed(() => [
  { value: 'recent', label: t('sort.recent') },
  { value: 'oldest', label: t('sort.oldest') },
  { value: 'provider', label: t('sort.provider') },
  { value: 'user', label: t('sort.user') },
])

const viewOptions = computed(() => [
  { value: 'grid', label: t('views.grid'), icon: 'i-lucide-layout-grid' },
  { value: 'list', label: t('views.list'), icon: 'i-lucide-list' },
  { value: 'table', label: t('views.table'), icon: 'i-lucide-table' },
])

const toolbarFilters = computed(() => [
  {
    key: 'provider',
    label: t('filters.provider'),
    value: filters.value.provider || 'all',
    options: providerOptions.value,
    width: 'w-full sm:w-52',
  },
])

const toolbarSort = computed(() => ({ value: sort.value, options: sortOptions.value }))

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'platform', label: t('columns.platform') },
  { key: 'user', label: t('columns.user') },
  { key: 'account', label: t('columns.account'), hideBelow: 'md' },
  { key: 'connected', label: t('columns.connected'), hideBelow: 'lg' },
])

async function fetchConnections() {
  loading.value = true
  try {
    const data = await $fetch<{ connections: AdminConnection[] }>('/api/v1/admin/connections')
    connections.value = data.connections
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.loadFailed'), color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(fetchConnections)

function handleRefresh() {
  fetchConnections()
}

function handleResetFilters() {
  resetFilters()
}
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="t('description')">
    <template #actions>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="outline"
        :loading="loading"
        :label="t('refresh')"
        @click="handleRefresh"
      />
    </template>

    <template #toolbar>
      <BaseCollectionToolbar
        :search="search"
        :search-placeholder="t('search')"
        :filters="toolbarFilters"
        :sort="toolbarSort"
        :view="view"
        :views="viewOptions"
        :busy="loading"
        @update:search="setSearch"
        @update:filter="(key: string, value: string) => setFilter(key, value)"
        @update:sort="setSort"
        @update:view="setView"
      />
    </template>

    <BaseCollectionGrid
      v-if="view === 'grid'"
      :items="filtered"
      :row-key="rowKey"
      :loading="loading"
      :empty-title="t('empty')"
      empty-icon="i-lucide-plug-zap"
    >
      <template #item="{ item: connection }">
        <BaseCollectionCard
          :title="providerLabel(connection.providerId)"
          :description="t('accountLabel', { account: connection.accountId })"
          :icon="providerIcon(connection.providerId)"
        >
          <div class="mt-3 flex items-center gap-2">
            <UAvatar
              :src="connection.userImage || undefined"
              :alt="connection.userName || connection.userEmail || t('unknownUser')"
              size="sm"
            />
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-highlighted">{{ userName(connection) }}</p>
              <p class="truncate text-xs text-muted">{{ connection.userEmail || '—' }}</p>
            </div>
          </div>

          <template #meta>
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-calendar" class="size-3.5" />
              {{ t('connectedOn', { date: formatDate(connection.createdAt) }) }}
            </span>
          </template>
        </BaseCollectionCard>
      </template>

      <template #empty>
        <UButton v-if="hasActiveFilters" variant="ghost" :label="t('clearFilters')" @click="handleResetFilters" />
      </template>
    </BaseCollectionGrid>

    <BaseCollectionList
      v-else-if="view === 'list'"
      :items="filtered"
      :row-key="rowKey"
      :loading="loading"
      :empty-title="t('empty')"
      empty-icon="i-lucide-plug-zap"
    >
      <template #item="{ item: connection }">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
          <UIcon :name="providerIcon(connection.providerId)" class="size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-highlighted">
            {{ providerLabel(connection.providerId) }}
          </p>
          <p class="truncate text-sm text-muted">{{ t('accountLabel', { account: connection.accountId }) }}</p>
        </div>
        <span class="hidden w-48 truncate text-sm text-muted md:block">{{ userName(connection) }}</span>
        <span class="hidden w-28 text-right text-xs text-muted lg:block">
          {{ formatDate(connection.createdAt) }}
        </span>
      </template>
    </BaseCollectionList>

    <BaseDataTable
      v-else
      :rows="filtered"
      :columns="columns"
      :row-key="rowKey"
      :loading="loading"
      :empty-title="t('empty')"
      empty-icon="i-lucide-plug-zap"
    >
      <template #cell-platform="{ row }">
        <div class="flex items-center gap-2">
          <span class="inline-flex rounded-lg bg-primary/10 p-2 text-primary">
            <UIcon :name="providerIcon(row.providerId)" class="size-4" />
          </span>
          <span class="text-sm">{{ providerLabel(row.providerId) }}</span>
        </div>
      </template>
      <template #cell-user="{ row }">
        <div class="flex items-center gap-3">
          <UAvatar
            :src="row.userImage || undefined"
            :alt="row.userName || row.userEmail || t('unknownUser')"
            size="sm"
          />
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-highlighted">{{ userName(row) }}</p>
            <p class="truncate text-xs text-muted">{{ row.userEmail || '—' }}</p>
          </div>
        </div>
      </template>
      <template #cell-account="{ row }">
        <span class="block max-w-48 truncate text-xs text-muted">{{ row.accountId }}</span>
      </template>
      <template #cell-connected="{ row }">
        <span class="whitespace-nowrap text-muted">{{ formatDate(row.createdAt) }}</span>
      </template>
    </BaseDataTable>
  </BaseCollectionPage>
</template>
