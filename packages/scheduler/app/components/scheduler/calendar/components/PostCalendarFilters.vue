<!--  Translation file -->
<i18n src="./PostCalendarFilters.json"></i18n>
<script setup lang="ts">
/**
 *
 * Component Description: the calendar's filter popover.
 *
 * A compact drop-in for `PostFiltersBar`, which is a full-width bar the posts
 * table has the vertical room for and a floating calendar header does not. One
 * trigger, four selectors, two buttons — the state, the query-param sync and
 * every label come from `usePostFilters` and this file's locale JSON, so the
 * calendar and `/app/posts` can never disagree about what a filter means.
 *
 * The popover does not fetch anything itself. It owns the selection and emits it
 * upward; the shell decides what a change costs.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 */
import {
  DATE_FILTER_OPTIONS,
  POST_FORMAT_OPTIONS,
  STATUS_FILTER_OPTIONS,
  PLATFORM_OPTIONS,
  usePostFilters
} from '#layers/BaseScheduler/app/composables/usePostFilters'
import type { PostFilters } from '#layers/BaseScheduler/server/utils/SchedulerTypes'

interface SelectOption<T> {
  label: string
  value: T
}

const emit = defineEmits<{
  /** The selection to read the range with. */
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
  getFilters,
  hasActiveFilters,
  initFromQuery,
  resetFilters,
  updateQueryParams
} = usePostFilters({ initialDateType: 'scheduledAt' })

/*
 * Every option list is a table lookup over the shared composable's own entries,
 * so adding a status or a platform there reaches this popover without a branch
 * here. Labels are translated here rather than in the shared lists, because
 * `/app/posts` renders them too and reshaping those would change that page.
 */
const dateTypeOptions = computed<SelectOption<string>[]>(() =>
  DATE_FILTER_OPTIONS.map(({ value }) => ({ label: t(`dateTypeOptions.${value}`), value }))
)

const statusOptions = computed<SelectOption<PostFilters['status'] | null>[]>(() =>
  STATUS_FILTER_OPTIONS.map(({ value }) => ({ label: value ? t(`statusOptions.${value}`) : t('statusOptions.all'), value }))
)

const formatOptions = computed<SelectOption<PostFilters['postFormat'] | null>[]>(() =>
  POST_FORMAT_OPTIONS.map(({ value }) => ({ label: value ? t(`formatOptions.${value}`) : t('formatOptions.all'), value }))
)

const platformOptions = computed<SelectOption<string>[]>(() =>
  PLATFORM_OPTIONS.map(({ value }) => ({ label: t(`platformOptions.${value}`), value }))
)

/** How many selectors are away from their default, shown on the trigger. */
const activeCount = computed(() =>
  Number(!!status.value)
  + Number(!!postFormat.value)
  + Number(platforms.value.length > 0)
  + Number(dateType.value !== 'scheduledAt')
)

const selectedPlatformsLabel = computed(() => t('selectedCount', { count: platforms.value.length }))

function handleApply() {
  updateQueryParams()
  emit('apply', getFilters())
}

function handleClear() {
  resetFilters()
  emit('clear')
}

// A shared calendar URL carries its filters in the query, so the selection is
// read back on mount rather than on the first open
onMounted(() => {
  initFromQuery()
  handleApply()
})
</script>

<template>
  <UPopover :content="{ align: 'end', side: 'bottom' }" :ui="{ content: 'w-72 p-3' }">
    <UButton
      icon="i-lucide-filter"
      color="neutral"
      variant="soft"
      size="sm"
      class="rounded-full"
      :class="activeCount > 0 && 'ring-1 ring-primary'"
      :aria-label="t('openFilters')"
    >
      <UBadge
        v-if="activeCount > 0"
        color="primary"
        variant="solid"
        size="sm"
        class="ms-1.5 tabular-nums"
        :label="String(activeCount)"
      />
    </UButton>

    <template #content>
      <div
        v-motion
        :initial="{ opacity: 0, y: -4 }"
        :enter="{ opacity: 1, y: 0, transition: { duration: 200 } }"
        class="flex flex-col gap-3"
      >
        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-muted">{{ t('dateType') }}</span>
          <USelect v-model="dateType" :items="dateTypeOptions" value-key="value" label-key="label" size="sm" />
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-muted">{{ t('status') }}</span>
          <USelect v-model="status" :items="statusOptions" value-key="value" label-key="label" size="sm" />
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-muted">{{ t('format') }}</span>
          <USelect v-model="postFormat" :items="formatOptions" value-key="value" label-key="label" size="sm" />
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-muted">{{ t('platforms') }}</span>
          <USelectMenu
            v-model="platforms"
            :items="platformOptions"
            multiple
            value-key="value"
            label-key="label"
            size="sm"
          >
            <UButton color="neutral" variant="outline" size="sm" class="w-full justify-between">
              <span>{{ platforms.length > 0 ? selectedPlatformsLabel : t('platforms') }}</span>
              <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 opacity-60" />
            </UButton>
          </USelectMenu>
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-default pt-2">
          <UButton
            v-if="hasActiveFilters"
            color="neutral"
            variant="ghost"
            size="xs"
            :label="t('clear')"
            @click="handleClear"
          />

          <UButton
            color="primary"
            variant="solid"
            size="xs"
            :label="t('apply')"
            @click="handleApply"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
