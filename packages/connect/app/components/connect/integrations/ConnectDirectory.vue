<!-- Translation file -->
<i18n src="#site/app/pages/app/integrations/connect.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Integrations directory with Grid, List and Table
 * views for connected providers. A search + token-status + sort toolbar drives
 * all three, matching the business directory shell. The grid keeps the rich
 * `ConnectIntegrationCard` (health, reconnect banner, pages menu); list and
 * table are compact renderings with the same reconnect / disconnect actions.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */
import type { ConnectDirectoryItem, IntegrationSort, IntegrationView } from '#layers/BaseConnect/app/composables/connect/integrations/useIntegrationDirectory'
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
  sortItems,
} = useIntegrationDirectory()

const view = ref<IntegrationView>('grid')
const search = ref('')
const statusFilter = ref<'all' | 'healthy' | 'expiring_soon' | 'expired'>('all')
const sort = ref<IntegrationSort>('recent')

const pagesTarget = ref<ConnectDirectoryItem | null>(null)
const pagesModalOpen = ref(false)

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

const viewOptions: { value: IntegrationView, label: string, icon: string }[] = [
  { value: 'grid', label: 'directory.view_grid', icon: 'i-lucide-layout-grid' },
  { value: 'list', label: 'directory.view_list', icon: 'i-lucide-list' },
  { value: 'table', label: 'directory.view_table', icon: 'i-lucide-table' },
]

const matchesSearch = (item: ConnectDirectoryItem, term: string): boolean => {
  if (!term) return true
  return `${item.name} ${item.platform ?? ''}`.toLowerCase().includes(term)
}

const matchesStatus = (item: ConnectDirectoryItem): boolean =>
  statusFilter.value === 'all' || healthStatus(item.health) === statusFilter.value

const filteredConnections = computed(() => {
  const term = search.value.trim().toLowerCase()
  const rows = props.connections.filter(item => matchesSearch(item, term) && matchesStatus(item))
  return sortItems(rows, sort.value)
})

const selectView = (next: IntegrationView) => {
  view.value = next
}

const reconnect = (item: ConnectDirectoryItem) => {
  HandleReconnect(item.accountId || item.id, item.platform || item.name)
}

const disconnect = (item: ConnectDirectoryItem) => {
  handleDisconnect(item.id)
}

const openPages = (item: ConnectDirectoryItem) => {
  pagesTarget.value = item
  pagesModalOpen.value = true
}

const menuItems = (item: ConnectDirectoryItem) => [[
  { label: t('menu.pages'), icon: 'i-heroicons-viewfinder-circle', onSelect: () => openPages(item) },
  { label: t('menu.reconnect'), icon: 'i-heroicons-arrow-path', onSelect: () => reconnect(item) },
  { label: t('menu.disconnect'), icon: 'i-heroicons-link-slash', color: 'error' as const, onSelect: () => disconnect(item) },
]]
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2">
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('directory.search')" class="w-full sm:w-64" />
      <USelect v-model="statusFilter" :items="statusOptions" value-key="value" label-key="label" class="w-full sm:w-44" />
      <USelect v-model="sort" :items="sortOptions" value-key="value" label-key="label" class="w-full sm:w-52" />

      <div class="ms-auto flex items-center gap-1">
        <UButton v-for="option in viewOptions" :key="option.value" :icon="option.icon" :label="t(option.label)"
          :variant="view === option.value ? 'solid' : 'ghost'" :color="view === option.value ? 'primary' : 'neutral'"
          size="sm" class="rounded-xl" @click="selectView(option.value)" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!filteredConnections.length" class="rounded-2xl border border-default py-16 text-center">
      <UIcon name="i-lucide-plug-zap" class="mx-auto mb-3 size-10 text-dimmed" />
      <p class="text-muted">{{ t('directory.empty') }}</p>
    </div>

    <template v-else>
      <!-- Grid -->
      <div v-if="view === 'grid'" :key="view" v-motion-fade :duration="200"
        class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <ConnectIntegrationCard v-for="item in filteredConnections" :id="item.id" :key="item.id" :name="item.name"
          :image="item.image || ''" :icon="item.icon" :tags="item.tags || []" :time="formattedDate(item.createdAt)"
          :connected="item.connected" :health="item.health" :platform="item.platform" :account-id="item.accountId"
          :show-edit="false" />
      </div>

      <!-- List -->
      <div v-else-if="view === 'list'" :key="view" v-motion-fade :duration="200"
        class="overflow-hidden rounded-2xl border border-default">
        <div v-for="item in filteredConnections" :key="item.id"
          class="flex items-center gap-3 border-b border-default px-4 py-3 last:border-0 hover:bg-accented/40">
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
            <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs"
              :aria-label="t('directory.actions')" />
          </UDropdownMenu>
        </div>
      </div>

      <!-- Table -->
      <div v-else :key="view" v-motion-fade :duration="200" class="overflow-x-auto rounded-2xl border border-default">
        <table class="w-full min-w-[48rem] text-sm">
          <thead>
            <tr class="border-b border-default text-left text-xs text-muted">
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.provider') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.status') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.platform') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.connected') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.activity') }}</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredConnections" :key="item.id"
              class="border-b border-default last:border-0 hover:bg-accented/40">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-elevated">
                    <UIcon :name="item.icon" class="size-5" />
                  </span>
                  <span class="truncate font-medium capitalize text-highlighted">{{ item.name }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <UBadge :color="statusTone(item)" variant="subtle" size="sm">{{ statusLabel(item) }}</UBadge>
              </td>
              <td class="px-4 py-3 capitalize text-muted">{{ item.platform || '—' }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-muted">{{ formattedDate(item.createdAt) }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-muted">{{ timeAgo(item.createdAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end">
                  <UDropdownMenu :items="menuItems(item)" :content="{ align: 'end' }">
                    <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs"
                      :aria-label="t('directory.actions')" />
                  </UDropdownMenu>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <ConnectPagesModal v-model:open="pagesModalOpen" :platform="pagesTarget?.platform" :name="pagesTarget?.name" />
  </div>
</template>

<style scoped></style>
