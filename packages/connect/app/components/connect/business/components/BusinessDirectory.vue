<i18n src="#site/app/pages/app/business/business.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Business directory with Grid, List and Table views.
 * A search + status + sort toolbar drives all three, matching the reference
 * "Projects" layout. Presentation facts (status, completeness, dates) come
 * from `useBusinessDirectory` so every view agrees.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */
import type { BusinessProfile } from '#layers/BaseDB/db/schema'
import type { BusinessSort, BusinessStatus, BusinessView } from '#layers/BaseConnect/app/composables/useBusinessDirectory'

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
  sortBusinesses,
} = useBusinessDirectory()

const view = ref<BusinessView>('grid')
const search = ref('')
const statusFilter = ref<BusinessStatus | 'all'>('all')
const sort = ref<BusinessSort>('recent')

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

const viewOptions: { value: BusinessView, label: string, icon: string }[] = [
  { value: 'grid', label: 'directory.view_grid', icon: 'i-lucide-layout-grid' },
  { value: 'list', label: 'directory.view_list', icon: 'i-lucide-list' },
  { value: 'table', label: 'directory.view_table', icon: 'i-lucide-table' },
]

const matchesSearch = (business: BusinessProfile, term: string): boolean => {
  if (!term) return true
  const haystack = [business.name, business.description, business.category, business.website]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(term)
}

const matchesStatus = (business: BusinessProfile): boolean =>
  statusFilter.value === 'all' || status(business) === statusFilter.value

const filteredBusinesses = computed(() => {
  const term = search.value.trim().toLowerCase()
  const rows = props.businesses.filter(business => matchesSearch(business, term) && matchesStatus(business))
  return sortBusinesses(rows, sort.value)
})

const isCurrent = (business: BusinessProfile): boolean => props.activeBusinessId === business.id

const selectView = (next: BusinessView) => {
  view.value = next
}

const handleEdit = (id: string) => emit('edit', id)
const handleDelete = (id: string) => emit('delete', id)
const handleSelect = (id: string) => emit('select', id)

const menuItems = (business: BusinessProfile) => [[
  { label: t('actions.edit'), icon: 'i-heroicons-pencil', onSelect: () => handleEdit(business.id) },
  { label: t('actions.playbook'), icon: 'i-lucide-book-open', onSelect: () => navigateTo(`/app/business/${business.id}/content/playbook`) },
  { label: t('actions.google_business'), icon: 'i-logos-google', onSelect: () => navigateTo(`/app/business/${business.id}/gmb`) },
], [
  { label: t('actions.delete'), icon: 'i-heroicons-trash', color: 'error' as const, onSelect: () => handleDelete(business.id) },
]]
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2">
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('directory.search')" class="w-full sm:w-64" />
      <USelect v-model="statusFilter" :items="statusOptions" value-key="value" label-key="label"
        class="w-full sm:w-40" />
      <USelect v-model="sort" :items="sortOptions" value-key="value" label-key="label" class="w-full sm:w-52" />

      <div class="ms-auto flex items-center gap-1">
        <UButton v-for="option in viewOptions" :key="option.value" :icon="option.icon" :label="t(option.label)"
          :variant="view === option.value ? 'solid' : 'ghost'" :color="view === option.value ? 'primary' : 'neutral'"
          size="sm" class="rounded-xl" @click="selectView(option.value)" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!filteredBusinesses.length" class="rounded-2xl border border-default py-16 text-center">
      <UIcon name="i-lucide-building-2" class="mx-auto mb-3 size-10 text-dimmed" />
      <p class="text-muted">{{ t('directory.empty') }}</p>
    </div>

    <template v-else>
      <!-- Grid -->
      <div v-if="view === 'grid'" :key="view" v-motion-fade :duration="200"
        class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UCard v-for="business in filteredBusinesses" :key="business.id" :ui="{ body: 'sm:p-4', root: 'sm:p-0' }"
          class="flex flex-col">
          <div class="flex items-start gap-3">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              :class="avatarColor(business.name)">{{ initial(business.name) }}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <h3 class="truncate font-semibold text-highlighted">{{ business.name }}</h3>
                <UButton v-if="!isCurrent(business)" icon="i-lucide-star" color="neutral" variant="ghost" size="xs"
                  :aria-label="t('directory.set_active')" @click="handleSelect(business.id)" />
                <UBadge class="ms-auto shrink-0" :color="statusTone(business)" variant="subtle" size="sm">
                  {{ statusLabel(business) }}
                </UBadge>
              </div>
              <p class="mt-1 line-clamp-2 min-h-10 text-sm text-muted">{{ subtitle(business) }}</p>

              <div class="mt-3 flex items-center gap-3">
                <UProgress :model-value="completeness(business).percent" size="sm" class="flex-1" />
                <span class="w-9 text-right text-xs tabular-nums text-muted">{{ completeness(business).percent
                  }}%</span>
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs whitespace-nowrap text-muted">
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-circle-check" class="size-3.5" />
                  {{ t('directory.fields_short', {
                    filled: completeness(business).filled, total:
                      completeness(business).total
                  }) }}
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-calendar" class="size-3.5" />
                  {{ shortDate(business.createdAt) }}
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-clock" class="size-3.5" />
                  {{ timeAgo(business.updatedAt) }}
                </span>
              </div>
            </div>

            <UDropdownMenu :items="menuItems(business)" :content="{ align: 'end' }">
              <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs"
                :aria-label="t('actions.more')" />
            </UDropdownMenu>
          </div>
        </UCard>
      </div>

      <!-- List -->
      <div v-else-if="view === 'list'" key="list" v-motion-fade :duration="200"
        class="overflow-hidden rounded-2xl border border-default">
        <div v-for="business in filteredBusinesses" :key="business.id"
          class="flex items-center gap-3 border-b border-default px-4 py-3 last:border-0 hover:bg-accented/40">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            :class="avatarColor(business.name)">{{ initial(business.name) }}</span>
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
          <span class="hidden w-24 text-right text-xs text-muted lg:block">{{ formattedDate(business.createdAt)
            }}</span>
          <UDropdownMenu :items="menuItems(business)" :content="{ align: 'end' }">
            <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs"
              :aria-label="t('actions.more')" />
          </UDropdownMenu>
        </div>
      </div>

      <!-- Table -->
      <div v-else key="table" v-motion-fade :duration="200" class="overflow-x-auto rounded-2xl border border-default">
        <table class="w-full min-w-[48rem] text-sm">
          <thead>
            <tr class="border-b border-default text-left text-xs text-muted">
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.business') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.status') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.category') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.website') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.progress') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.fields') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.created') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('directory.columns.updated') }}</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="business in filteredBusinesses" :key="business.id"
              class="border-b border-default last:border-0 hover:bg-accented/40">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                    :class="avatarColor(business.name)">{{ initial(business.name) }}</span>
                  <span class="truncate font-medium text-highlighted">{{ business.name }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <UBadge :color="statusTone(business)" variant="subtle" size="sm">{{ statusLabel(business) }}</UBadge>
              </td>
              <td class="px-4 py-3 text-muted">{{ business.category || '—' }}</td>
              <td class="px-4 py-3 text-muted">{{ business.website || '—' }}</td>
              <td class="px-4 py-3">
                <div class="flex w-36 items-center gap-2">
                  <UProgress :model-value="completeness(business).percent" size="sm" class="flex-1" />
                  <span class="w-9 text-right text-xs tabular-nums text-muted">{{ completeness(business).percent
                    }}%</span>
                </div>
              </td>
              <td class="px-4 py-3 tabular-nums text-muted">{{ completeness(business).filled }}/{{
                completeness(business).total }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-muted">{{ formattedDate(business.createdAt) }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-muted">{{ timeAgo(business.updatedAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end">
                  <UDropdownMenu :items="menuItems(business)" :content="{ align: 'end' }">
                    <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs"
                      :aria-label="t('actions.more')" />
                  </UDropdownMenu>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped></style>
