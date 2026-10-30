<i18n src="#site/app/pages/app/business/business.json"></i18n>

<script lang="ts" setup>
/**
 * Business directory with Grid, List and Table views.
 *
 * Reference implementation for the shared collection components:
 * `BaseCollectionToolbar` drives `useCollectionView()`, and one derived helper
 * (`useBusinessDirectory`) feeds every view so they can never disagree.
 */
import type { BusinessProfile } from '#layers/BaseDB/db/schema'
import type { BusinessSort, BusinessStatus, BusinessView } from '#layers/BaseConnect/app/composables/useBusinessDirectory'
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'

const props = defineProps<{
  businesses: BusinessProfile[]
  activeBusinessId?: string
}>()

const emit = defineEmits<{
  edit: [id: string]
  delete: [id: string]
  select: [id: string]
}>()

const { t } = useI18n()
const {
  initial,
  avatarColor,
  status,
  statusTone,
  statusLabel,
  subtitle,
  formattedDate,
  shortDate,
  timeAgo,
  completeness,
} = useBusinessDirectory()

const rows = computed(() => props.businesses)

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
} = useCollectionView<BusinessProfile>({
  key: 'app-business',
  modes: ['grid', 'list', 'table'] satisfies BusinessView[],
  defaultView: 'grid',
  rows,
  searchFields: business => [business.name, business.description, business.category, business.website],
  filterFns: {
    status: (business, value) => status(business) === value,
  },
  sorters: {
    recent: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    name: (a, b) => a.name.localeCompare(b.name),
    newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  },
  initialSort: 'recent',
})

const statusOptions = computed(() => [
  { value: 'all', label: t('directory.all_statuses') },
  { value: 'active', label: t('directory.status_active') },
  { value: 'inactive', label: t('directory.status_inactive') },
])

const sortOptions = computed(() => [
  { value: 'recent', label: t('directory.sort_recent') },
  { value: 'name', label: t('directory.sort_name') },
  { value: 'newest', label: t('directory.sort_newest') },
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
  { key: 'business', label: t('directory.columns.business') },
  { key: 'status', label: t('directory.columns.status') },
  { key: 'category', label: t('directory.columns.category'), hideBelow: 'md' },
  { key: 'website', label: t('directory.columns.website'), hideBelow: 'lg' },
  { key: 'progress', label: t('directory.columns.progress'), hideBelow: 'md' },
  { key: 'fields', label: t('directory.columns.fields'), hideBelow: 'xl' },
  { key: 'created', label: t('directory.columns.created'), hideBelow: 'xl' },
  { key: 'updated', label: t('directory.columns.updated'), hideBelow: 'lg' },
]

const isCurrent = (business: BusinessProfile): boolean => props.activeBusinessId === business.id
const rowKey = (business: BusinessProfile): string => business.id

function handleEdit(id: string) {
  emit('edit', id)
}

function handleDelete(id: string) {
  emit('delete', id)
}

function handleSelect(id: string) {
  emit('select', id)
}

function menuItems(business: BusinessProfile) {
  return [[
    { label: t('actions.edit'), icon: 'i-heroicons-pencil', onSelect: () => handleEdit(business.id) },
    { label: t('actions.playbook'), icon: 'i-lucide-book-open', onSelect: () => navigateTo(`/app/business/${business.id}/content/playbook`) },
    { label: t('actions.google_business'), icon: 'i-logos-google', onSelect: () => navigateTo(`/app/business/${business.id}/gmb`) },
  ], [
    { label: t('actions.delete'), icon: 'i-heroicons-trash', color: 'error' as const, onSelect: () => handleDelete(business.id) },
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
      @update:view="(next: BusinessView) => setView(next)"
    />

    <BaseCollectionGrid
      v-if="view === 'grid'"
      :items="filtered"
      :row-key="rowKey"
      :empty-title="t('directory.empty')"
      empty-icon="i-lucide-building-2"
    >
      <template #item="{ item: business }">
        <BaseCollectionCard
          :title="business.name"
          :description="subtitle(business)"
          :avatar-text="initial(business.name)"
          :avatar-class="avatarColor(business.name)"
          :badge="statusLabel(business)"
          :badge-color="statusTone(business)"
          :menu="menuItems(business)"
        >
          <template #title-actions>
            <UButton
              v-if="!isCurrent(business)"
              icon="i-lucide-star"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="t('directory.set_active')"
              @click="() => handleSelect(business.id)"
            />
          </template>

          <div class="mt-3 flex items-center gap-3">
            <UProgress :model-value="completeness(business).percent" size="sm" class="flex-1" />
            <span class="w-9 text-right text-xs tabular-nums text-muted">{{ completeness(business).percent }}%</span>
          </div>

          <template #meta>
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-circle-check" class="size-3.5" />
              {{ t('directory.fields_short', { filled: completeness(business).filled, total: completeness(business).total }) }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-calendar" class="size-3.5" />
              {{ shortDate(business.createdAt) }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-clock" class="size-3.5" />
              {{ timeAgo(business.updatedAt) }}
            </span>
          </template>
        </BaseCollectionCard>
      </template>

      <template #empty>
        <UButton v-if="hasActiveFilters" variant="ghost" @click="resetFilters">{{ t('directory.empty') }}</UButton>
      </template>
    </BaseCollectionGrid>

    <BaseCollectionList
      v-else-if="view === 'list'"
      :items="filtered"
      :row-key="rowKey"
      :empty-title="t('directory.empty')"
      empty-icon="i-lucide-building-2"
    >
      <template #item="{ item: business }">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" :class="avatarColor(business.name)">
          {{ initial(business.name) }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-highlighted">{{ business.name }}</p>
          <p class="truncate text-sm text-muted">{{ subtitle(business) }}</p>
        </div>
        <UBadge class="hidden shrink-0 sm:inline-flex" :color="statusTone(business)" variant="subtle" size="sm">
          {{ statusLabel(business) }}
        </UBadge>
        <div class="hidden w-36 items-center gap-2 md:flex">
          <UProgress :model-value="completeness(business).percent" size="sm" class="flex-1" />
          <span class="w-9 text-right text-xs tabular-nums text-muted">{{ completeness(business).percent }}%</span>
        </div>
        <span class="hidden w-24 text-right text-xs text-muted lg:block">{{ formattedDate(business.createdAt) }}</span>
        <UDropdownMenu :items="menuItems(business)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs" :aria-label="t('actions.more')" />
        </UDropdownMenu>
      </template>
    </BaseCollectionList>

    <BaseDataTable
      v-else
      :rows="filtered"
      :columns="columns"
      :row-key="rowKey"
      :empty-title="t('directory.empty')"
      empty-icon="i-lucide-building-2"
    >
      <template #cell-business="{ row }">
        <div class="flex items-center gap-3">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" :class="avatarColor(row.name)">
            {{ initial(row.name) }}
          </span>
          <span class="truncate font-medium text-highlighted">{{ row.name }}</span>
        </div>
      </template>
      <template #cell-status="{ row }">
        <UBadge :color="statusTone(row)" variant="subtle" size="sm">{{ statusLabel(row) }}</UBadge>
      </template>
      <template #cell-progress="{ row }">
        <div class="flex w-36 items-center gap-2">
          <UProgress :model-value="completeness(row).percent" size="sm" class="flex-1" />
          <span class="w-9 text-right text-xs tabular-nums text-muted">{{ completeness(row).percent }}%</span>
        </div>
      </template>
      <template #cell-fields="{ row }">
        <span class="tabular-nums text-muted">{{ completeness(row).filled }}/{{ completeness(row).total }}</span>
      </template>
      <template #cell-created="{ row }">
        <span class="whitespace-nowrap text-muted">{{ formattedDate(row.createdAt) }}</span>
      </template>
      <template #cell-updated="{ row }">
        <span class="whitespace-nowrap text-muted">{{ timeAgo(row.updatedAt) }}</span>
      </template>
      <template #row-actions="{ row }">
        <UDropdownMenu :items="menuItems(row)" :content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs" :aria-label="t('actions.more')" />
        </UDropdownMenu>
      </template>
    </BaseDataTable>
  </div>
</template>
