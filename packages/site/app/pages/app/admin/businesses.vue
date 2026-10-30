<i18n src="./businesses.json"></i18n>

<script lang="ts" setup>
/**
 * Admin → Businesses.
 *
 * Grid / list / table directory over every business profile, built on the
 * shared collection shell: `useCollectionView` owns search / status / sort,
 * `BaseCollectionToolbar` renders the controls and each view reads the same
 * `filtered` list so they can never disagree.
 */
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'

definePageMeta({
  layout: 'dashboard-layout',
})

interface AdminBusiness {
  id: string
  name: string | null
  description: string | null
  category: string | null
  address: string | null
  website: string | null
  phone: string | null
  isActive: boolean | null
  userId: string | null
  createdAt: string
}

const { t } = useI18n()
const toast = useToast()

const businesses = ref<AdminBusiness[]>([])
const loading = ref(true)

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
} = useCollectionView<AdminBusiness>({
  key: 'admin-businesses',
  modes: ['grid', 'list', 'table'],
  defaultView: 'grid',
  rows: businesses,
  searchFields: business => [
    business.name,
    business.description,
    business.category,
    business.website,
    business.address,
    business.phone,
  ],
  filterFns: {
    status: (business, value) => (business.isActive ? 'active' : 'inactive') === value,
  },
  sorters: {
    recent: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    oldest: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    name: (a, b) => (a.name || '').localeCompare(b.name || ''),
  },
  initialSort: 'recent',
})

const activeCount = computed(() => businesses.value.filter(business => business.isActive).length)
const subtitle = computed(() => t('subtitle', { active: activeCount.value, total: businesses.value.length }))

const rowKey = (business: AdminBusiness): string => business.id

function displayName(business: AdminBusiness): string {
  return business.name || t('unnamed')
}

function initial(business: AdminBusiness): string {
  return displayName(business).trim().charAt(0).toUpperCase()
}

function statusLabel(business: AdminBusiness): string {
  return business.isActive ? t('status.active') : t('status.inactive')
}

function statusTone(business: AdminBusiness): 'success' | 'neutral' {
  return business.isActive ? 'success' : 'neutral'
}

const statusOptions = computed(() => [
  { value: 'all', label: t('filters.allStatuses') },
  { value: 'active', label: t('status.active') },
  { value: 'inactive', label: t('status.inactive') },
])

const sortOptions = computed(() => [
  { value: 'recent', label: t('sort.recent') },
  { value: 'oldest', label: t('sort.oldest') },
  { value: 'name', label: t('sort.name') },
])

const viewOptions = computed(() => [
  { value: 'grid', label: t('views.grid'), icon: 'i-lucide-layout-grid' },
  { value: 'list', label: t('views.list'), icon: 'i-lucide-list' },
  { value: 'table', label: t('views.table'), icon: 'i-lucide-table' },
])

const toolbarFilters = computed(() => [
  {
    key: 'status',
    label: t('filters.status'),
    value: filters.value.status || 'all',
    options: statusOptions.value,
    width: 'w-full sm:w-44',
  },
])

const toolbarSort = computed(() => ({ value: sort.value, options: sortOptions.value }))

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'business', label: t('columns.business') },
  { key: 'category', label: t('columns.category'), hideBelow: 'md' },
  { key: 'website', label: t('columns.website'), hideBelow: 'lg' },
  { key: 'status', label: t('columns.status') },
])

async function fetchBusinesses() {
  loading.value = true
  try {
    const data = await $fetch<{ businesses: AdminBusiness[] }>('/api/v1/admin/businesses')
    businesses.value = data.businesses
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.loadFailed'), color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(fetchBusinesses)

function handleRefresh() {
  fetchBusinesses()
}

function handleResetFilters() {
  resetFilters()
}

const selectedBusiness = ref<AdminBusiness | null>(null)
const showEditModal = ref(false)
const saving = ref(false)
const editForm = ref<{
  name: string
  category: string
  address: string
  website: string
  phone: string
  description: string
  isActive: boolean
}>({
  name: '',
  category: '',
  address: '',
  website: '',
  phone: '',
  description: '',
  isActive: true,
})

function openEdit(business: AdminBusiness) {
  selectedBusiness.value = business
  editForm.value = {
    name: business.name || '',
    category: business.category || '',
    address: business.address || '',
    website: business.website || '',
    phone: business.phone || '',
    description: business.description || '',
    isActive: business.isActive ?? true,
  }
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
}

async function saveBusiness() {
  if (!selectedBusiness.value) return
  const label = displayName(selectedBusiness.value)
  saving.value = true
  try {
    await $fetch(`/api/v1/admin/businesses/${selectedBusiness.value.id}`, {
      method: 'PUT',
      body: editForm.value,
    })
    toast.add({
      title: t('toast.updatedTitle'),
      description: t('toast.updatedDescription', { name: label }),
      color: 'success',
    })
    showEditModal.value = false
    await fetchBusinesses()
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.updateFailed'), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function deleteBusiness(business: AdminBusiness) {
  try {
    await $fetch(`/api/v1/admin/businesses/${business.id}`, { method: 'DELETE' })
    toast.add({
      title: t('toast.deletedTitle'),
      description: t('toast.deletedDescription', { name: displayName(business) }),
      color: 'success',
    })
    await fetchBusinesses()
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.deleteFailed'), color: 'error' })
  }
}

function confirmDelete(business: AdminBusiness) {
  toast.add({
    title: t('confirmDelete.title'),
    description: t('confirmDelete.description', { name: displayName(business) }),
    color: 'error',
    actions: [
      { label: t('confirmDelete.confirm'), color: 'error', variant: 'solid', onClick: () => deleteBusiness(business) },
      { label: t('confirmDelete.cancel'), color: 'neutral', variant: 'outline' },
    ],
  })
}

function menuItems(business: AdminBusiness) {
  return [[
    { label: t('actions.edit'), icon: 'i-lucide-pencil', onSelect: () => openEdit(business) },
    { label: t('actions.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => confirmDelete(business) },
  ]]
}
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="subtitle">
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
      empty-icon="i-lucide-building-2"
    >
      <template #item="{ item: business }">
        <BaseCollectionCard
          :title="displayName(business)"
          :description="business.description || ''"
          :avatar-text="initial(business)"
          :badge="statusLabel(business)"
          :badge-color="statusTone(business)"
          :menu="menuItems(business)"
        >
          <template #meta>
            <span v-if="business.category" class="flex items-center gap-1">
              <UIcon name="i-lucide-tag" class="size-3.5" />
              {{ business.category }}
            </span>
            <span v-if="business.website" class="flex items-center gap-1">
              <UIcon name="i-lucide-globe" class="size-3.5" />
              {{ business.website }}
            </span>
            <span v-if="business.phone" class="flex items-center gap-1">
              <UIcon name="i-lucide-phone" class="size-3.5" />
              {{ business.phone }}
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
      empty-icon="i-lucide-building-2"
    >
      <template #item="{ item: business }">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
          {{ initial(business) }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-highlighted">{{ displayName(business) }}</p>
          <p class="truncate text-sm text-muted">
            {{ business.category || business.website || business.address || t('noDetails') }}
          </p>
        </div>
        <UBadge class="hidden shrink-0 sm:inline-flex" :color="statusTone(business)" variant="subtle" size="sm">
          {{ statusLabel(business) }}
        </UBadge>
        <span class="hidden w-40 truncate text-right text-xs text-muted lg:block">
          {{ business.website || '—' }}
        </span>
        <UDropdownMenu :items="menuItems(business)" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="t('actions.more')"
          />
        </UDropdownMenu>
      </template>
    </BaseCollectionList>

    <BaseDataTable
      v-else
      :rows="filtered"
      :columns="columns"
      :row-key="rowKey"
      :loading="loading"
      :empty-title="t('empty')"
      empty-icon="i-lucide-building-2"
    >
      <template #cell-business="{ row }">
        <div class="flex items-center gap-3">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
            {{ initial(row) }}
          </span>
          <span class="truncate font-medium text-highlighted">{{ displayName(row) }}</span>
        </div>
      </template>
      <template #cell-category="{ row }">
        <span class="text-muted">{{ row.category || '—' }}</span>
      </template>
      <template #cell-website="{ row }">
        <span class="block max-w-48 truncate text-muted">{{ row.website || '—' }}</span>
      </template>
      <template #cell-status="{ row }">
        <UBadge :color="statusTone(row)" variant="subtle" size="sm">{{ statusLabel(row) }}</UBadge>
      </template>
      <template #row-actions="{ row }">
        <UDropdownMenu :items="menuItems(row)" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="t('actions.more')"
          />
        </UDropdownMenu>
      </template>
    </BaseDataTable>

    <UModal v-model:open="showEditModal">
      <template #content>
        <UCard v-if="selectedBusiness">
          <template #header>
            <h3 class="text-lg font-semibold">{{ t('modal.title') }}</h3>
          </template>
          <div class="space-y-4">
            <UFormField :label="t('modal.name')">
              <UInput v-model="editForm.name" :placeholder="t('modal.namePlaceholder')" class="w-full" />
            </UFormField>
            <UFormField :label="t('modal.category')">
              <UInput v-model="editForm.category" :placeholder="t('modal.categoryPlaceholder')" class="w-full" />
            </UFormField>
            <UFormField :label="t('modal.address')">
              <UInput v-model="editForm.address" :placeholder="t('modal.addressPlaceholder')" class="w-full" />
            </UFormField>
            <UFormField :label="t('modal.website')">
              <UInput v-model="editForm.website" :placeholder="t('modal.websitePlaceholder')" class="w-full" />
            </UFormField>
            <UFormField :label="t('modal.phone')">
              <UInput v-model="editForm.phone" :placeholder="t('modal.phonePlaceholder')" class="w-full" />
            </UFormField>
            <UFormField :label="t('modal.description')">
              <UTextarea
                v-model="editForm.description"
                :placeholder="t('modal.descriptionPlaceholder')"
                :rows="3"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('modal.active')">
              <UCheckbox v-model="editForm.isActive" :label="t('modal.activeLabel')" />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" :label="t('modal.cancel')" @click="closeEditModal" />
              <UButton color="primary" :loading="saving" :label="t('modal.save')" @click="saveBusiness" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </BaseCollectionPage>
</template>
