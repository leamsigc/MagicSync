<!--  Translation file -->
<i18n src="./PostCalendarFilters.json"></i18n>
<script setup lang="ts">
/**
 *
 * Component Description: the calendar's filter popover, in a filter-builder
 * style: one row per active dimension (field, operator, values), an add-filter
 * tray for the rest, and a clear-all header. Every change applies instantly —
 * there is no Apply step — through the same `usePostFilters` state and
 * query-param sync `/app/posts` uses, so a filtered calendar URL stays
 * shareable.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import {
  DATE_FILTER_OPTIONS,
  DATE_WINDOW_OPTIONS,
  PLATFORM_OPTIONS,
  POST_FORMAT_OPTIONS,
  STATUS_FILTER_OPTIONS,
  usePostFilters,
} from '#layers/BaseScheduler/app/composables/usePostFilters'
import type { PostFilters } from '#layers/BaseScheduler/server/utils/SchedulerTypes'
import { usePlatformIcons } from '#layers/BaseUI/app/composables/usePlatformIcons'

type FilterDim = 'status' | 'platform' | 'format' | 'date'

interface ValueItem {
  label: string
  value: string
  icon: string
}

const emit = defineEmits<{
  /** The selection to read the range with. Fires on every change. */
  apply: [filters: PostFilters]
  /** Every selector is back to its default. */
  clear: []
}>()

const { t } = useI18n()

const {
  dateType,
  status,
  postFormat,
  platforms,
  dateWindow,
  getFilters,
  hasActiveFilters,
  filtersCount,
  initFromQuery,
  resetFilters,
  updateQueryParams,
} = usePostFilters({ initialDateType: 'scheduledAt' })

const { getPlatformIcon, isPlatformSupported } = usePlatformIcons()

/** One row per dimension currently constraining the grid. */
const activeRows = ref<FilterDim[]>([])

const DIMS: Record<FilterDim, { icon: string }> = {
  status: { icon: 'i-lucide-flag' },
  platform: { icon: 'i-lucide-globe' },
  format: { icon: 'i-lucide-layout-grid' },
  date: { icon: 'i-lucide-calendar' },
}

const STATUS_ICONS: Record<string, string> = {
  pending: 'i-lucide-clock',
  published: 'i-lucide-check',
  failed: 'i-lucide-x',
}

const FORMAT_ICONS: Record<string, string> = {
  post: 'i-lucide-file-text',
  reel: 'i-lucide-clapperboard',
  story: 'i-lucide-zap',
  short: 'i-lucide-play',
}

const DATE_ICONS: Record<string, string> = {
  scheduledAt: 'i-lucide-calendar-clock',
  createdAt: 'i-lucide-calendar-plus',
  publishedAt: 'i-lucide-calendar-check',
}

const WINDOW_ICONS: Record<string, string> = {
  overdue: 'i-lucide-history',
  today: 'i-lucide-calendar-days',
  next7: 'i-lucide-calendar-range',
  later: 'i-lucide-calendar-clock',
}

function platformIcon(value: string): string {
  return getPlatformIcon(isPlatformSupported(value) ? value : 'default')
}

/** Every dimension's option list, labels translated once here. */
const dimConfigs = computed<Record<FilterDim, { items: ValueItem[]; multiple: boolean }>>(() => ({
  status: {
    multiple: false,
    items: STATUS_FILTER_OPTIONS.filter(option => option.value).map(option => ({
      label: t(`statusOptions.${option.value}`),
      value: option.value as string,
      icon: STATUS_ICONS[option.value as string] ?? 'i-lucide-circle-dot',
    })),
  },
  platform: {
    multiple: true,
    items: PLATFORM_OPTIONS.map(option => ({
      label: t(`platformOptions.${option.value}`),
      value: option.value,
      icon: platformIcon(option.value),
    })),
  },
  format: {
    multiple: false,
    items: POST_FORMAT_OPTIONS.filter(option => option.value).map(option => ({
      label: t(`formatOptions.${option.value}`),
      value: option.value as string,
      icon: FORMAT_ICONS[option.value as string] ?? 'i-lucide-file-text',
    })),
  },
  date: {
    multiple: false,
    items: DATE_FILTER_OPTIONS.map(option => ({
      label: t(`dateTypeOptions.${option.value}`),
      value: option.value,
      icon: DATE_ICONS[option.value] ?? 'i-lucide-calendar',
    })),
  },
}))

/** The window options with translated labels, for the date row's second select. */
const windowItems = computed<ValueItem[]>(() =>
  DATE_WINDOW_OPTIONS.map(option => ({
    label: t(`dateWindows.${option.value}`),
    value: option.value,
    icon: WINDOW_ICONS[option.value] ?? 'i-lucide-calendar',
  })),
)

/** Dimensions without a row, offered by the add-filter tray. */
const inactiveDims = computed(() =>
  (Object.keys(DIMS) as FilterDim[]).filter(dim => !activeRows.value.includes(dim)),
)

/** A row's current value as display text, or the empty prompt. */
function valueLabel(dim: FilterDim): string {
  if (dim === 'status') {
    return status.value ? t(`statusOptions.${status.value}`) : t('selectPlaceholder')
  }
  if (dim === 'platform') {
    return platforms.value.length > 0
      ? t('selectedCount', { count: platforms.value.length })
      : t('selectPlaceholder')
  }
  if (dim === 'format') {
    return postFormat.value ? t(`formatOptions.${postFormat.value}`) : t('selectPlaceholder')
  }
  if (dateWindow.value) {
    return t(`dateWindows.${dateWindow.value}`)
  }
  return t(`dateTypeOptions.${dateType.value}`)
}

/** Whether an option reads as checked inside its dropdown. */
function isChecked(dim: FilterDim, value: string): boolean {
  if (dim === 'platform') {
    return platforms.value.includes(value)
  }
  if (dim === 'status') {
    return status.value === value
  }
  if (dim === 'format') {
    return postFormat.value === value
  }
  return dateType.value === value
}

/** Fields a row can switch to: every dimension except the ones other rows hold. */
function fieldItems(rowIndex: number) {
  const held = activeRows.value.filter((_, index) => index !== rowIndex)

  return (Object.keys(DIMS) as FilterDim[])
    .filter(dim => !held.includes(dim))
    .map(dim => ({ label: t(`fields.${dim}`), value: dim, icon: DIMS[dim].icon }))
}

const resetters: Record<FilterDim, () => void> = {
  status: () => {
    status.value = null
  },
  platform: () => {
    platforms.value = []
  },
  format: () => {
    postFormat.value = null
  },
  date: () => {
    dateType.value = 'scheduledAt'
    dateWindow.value = null
  },
}

function addDim(dim: FilterDim) {
  if (!activeRows.value.includes(dim)) {
    activeRows.value = [...activeRows.value, dim]
  }
}

function setRowDim(rowIndex: number, dim: FilterDim) {
  const prev = activeRows.value[rowIndex]

  if (prev && prev !== dim) {
    resetters[prev]()
  }

  activeRows.value.splice(rowIndex, 1, dim)
}

function removeRow(dim: FilterDim) {
  resetters[dim]()
  activeRows.value = activeRows.value.filter(row => row !== dim)
}

function clearAll() {
  resetFilters()
  activeRows.value = []
  emit('clear')
}

/** The date row constrains the grid while its column moved off default or a window is picked. */
function isDateActive(): boolean {
  return dateType.value !== 'scheduledAt' || dateWindow.value !== null
}

onMounted(() => {
  initFromQuery()

  const rows: FilterDim[] = []

  if (status.value) {
    rows.push('status')
  }
  if (platforms.value.length > 0) {
    rows.push('platform')
  }
  if (postFormat.value) {
    rows.push('format')
  }
  if (isDateActive()) {
    rows.push('date')
  }

  activeRows.value = rows
})

// Instant apply: every change re-reads the range through the shell, which
// no-ops when the query string did not actually move.
watch([status, postFormat, dateType, dateWindow, platforms], () => {
  updateQueryParams()
  emit('apply', getFilters())
}, { deep: true })
</script>

<template>
  <UPopover :content="{ align: 'end', side: 'bottom' }" :ui="{ content: 'w-[32rem] max-w-[calc(100vw-2rem)] p-4' }">
    <UButton
      icon="i-lucide-filter"
      color="neutral"
      variant="soft"
      size="sm"
      class="rounded-full"
      :aria-label="t('openFilters')"
    >
      <UBadge
        v-if="filtersCount > 0"
        color="primary"
        variant="solid"
        size="sm"
        class="ms-1 tabular-nums"
      >
        {{ filtersCount }}
      </UBadge>
    </UButton>

    <template #content>
      <div
        v-motion
        :initial="{ opacity: 0, y: -4 }"
        :enter="{ opacity: 1, y: 0, transition: { duration: 200 } }"
        class="flex flex-col gap-3"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('filterBy') }}</span>
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            :disabled="!hasActiveFilters && activeRows.length === 0"
            @click="clearAll"
          >
            {{ t('clearAll') }}
          </UButton>
        </div>

        <div
          v-for="(dim, rowIndex) in activeRows"
          :key="dim"
          class="grid grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] items-center gap-2"
        >
          <span class="w-11 text-sm text-dimmed">{{ rowIndex === 0 ? t('where') : t('and') }}</span>

          <USelectMenu
            :model-value="dim"
            :items="fieldItems(rowIndex)"
            value-key="value"
            size="sm"
            class="w-28"
            @update:model-value="setRowDim(rowIndex, $event)"
          >
            <template #leading>
              <UIcon :name="DIMS[dim].icon" class="size-4 shrink-0 text-dimmed" />
            </template>
          </USelectMenu>

          <span class="rounded-lg border border-default px-2.5 py-1.5 text-sm text-dimmed">{{ t('isOperator') }}</span>

          <div v-if="dim === 'date'" class="flex min-w-0 gap-1.5">
            <USelectMenu
              v-model="dateType"
              :items="dimConfigs[dim].items"
              value-key="value"
              size="sm"
              class="w-28 shrink-0"
            />
            <USelectMenu
              v-model="dateWindow"
              :items="windowItems"
              value-key="value"
              :placeholder="t('selectPlaceholder')"
              size="sm"
              class="min-w-0 flex-1"
            >
              <template #item-leading="{ item }">
                <span class="flex items-center gap-1.5">
                  <UCheckbox :model-value="dateWindow === item.value" tabindex="-1" />
                  <UIcon :name="item.icon" class="size-4 shrink-0" />
                </span>
              </template>
            </USelectMenu>
          </div>

          <USelectMenu
            v-else-if="dim === 'platform'"
            v-model="platforms"
            :items="dimConfigs[dim].items"
            multiple
            value-key="value"
            :placeholder="t('selectPlaceholder')"
            size="sm"
            class="min-w-0"
          >
            <template #item-leading="{ item }">
              <span class="flex items-center gap-1.5">
                <UCheckbox :model-value="isChecked(dim, item.value)" tabindex="-1" />
                <UIcon :name="item.icon" class="size-4 shrink-0" />
              </span>
            </template>
          </USelectMenu>

          <USelectMenu
            v-else-if="dim === 'status'"
            v-model="status"
            :items="dimConfigs[dim].items"
            value-key="value"
            :placeholder="t('selectPlaceholder')"
            size="sm"
            class="min-w-0"
          >
            <template #item-leading="{ item }">
              <span class="flex items-center gap-1.5">
                <UCheckbox :model-value="isChecked(dim, item.value)" tabindex="-1" />
                <UIcon :name="item.icon" class="size-4 shrink-0" />
              </span>
            </template>
          </USelectMenu>

          <USelectMenu
            v-else
            v-model="postFormat"
            :items="dimConfigs.format.items"
            value-key="value"
            :placeholder="t('selectPlaceholder')"
            size="sm"
            class="min-w-0"
          >
            <template #item-leading="{ item }">
              <span class="flex items-center gap-1.5">
                <UCheckbox :model-value="isChecked('format', item.value)" tabindex="-1" />
                <UIcon :name="item.icon" class="size-4 shrink-0" />
              </span>
            </template>
          </USelectMenu>

          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            :aria-label="t('removeFilter', { field: t(`fields.${dim}`) })"
            @click="removeRow(dim)"
          />
        </div>

        <div v-if="inactiveDims.length > 0" class="flex flex-wrap items-center gap-1.5">
          <span class="text-xs text-dimmed">{{ t('addFilter') }}</span>
          <UButton
            v-for="dim in inactiveDims"
            :key="dim"
            variant="outline"
            color="neutral"
            size="xs"
            :icon="DIMS[dim].icon"
            @click="addDim(dim)"
          >
            {{ t(`fields.${dim}`) }}
          </UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>
