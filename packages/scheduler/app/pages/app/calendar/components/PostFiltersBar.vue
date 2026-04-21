<script lang="ts" setup>
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import {
  DATE_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  POST_FORMAT_OPTIONS,
  LIMIT_OPTIONS,
  PLATFORM_OPTIONS
} from '#layers/BaseScheduler/app/composables/usePostFilters'
import type { PostFilters } from '#layers/BaseScheduler/server/utils/SchedulerTypes'

interface Emits {
  filterChange: [filters: PostFilters & { page: number, limit: number }]
  refresh: []
}

defineProps<{
  showPlatformFilter?: boolean
  showPostFormatFilter?: boolean
}>()

const emit = defineEmits<Emits>()

const {
  dateType,
  status,
  startDate,
  endDate,
  postFormat,
  platforms,
  limit,
  getFilters,
  getPagination,
  updateQueryParams,
  resetFilters,
  hasActiveFilters,
  filtersCount,
  initFromQuery
} = usePostFilters({ initialDateType: 'scheduledAt', initialLimit: 25 })

const df = new DateFormatter('en-US', {
  dateStyle: 'medium'
})

const startDateValue = shallowRef<CalendarDate | null | undefined>(null)
const endDateValue = shallowRef<CalendarDate | null | undefined>(null)

const formatDateValue = (dateValue: CalendarDate | null) => {
  if (!dateValue) return ''
  return df.format(dateValue.toDate(getLocalTimeZone()))
}

const onStartDateChange = (value: CalendarDate | null | undefined) => {
  startDateValue.value = value ?? null
  if (value) {
    startDate.value = value.toDate(getLocalTimeZone()).toISOString().split('T')[0] ?? ''
  } else {
    startDate.value = ''
  }
}

const onEndDateChange = (value: CalendarDate | null | undefined) => {
  endDateValue.value = value ?? null
  if (value) {
    endDate.value = value.toDate(getLocalTimeZone()).toISOString().split('T')[0] ?? ''
  } else {
    endDate.value = ''
  }
}

const initCalendarDates = () => {
  if (startDate.value) {
    const date = new Date(startDate.value)
    startDateValue.value = new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
  }
  if (endDate.value) {
    const date = new Date(endDate.value)
    endDateValue.value = new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
  }
}

const showFilters = ref(false)
const isLoading = ref(false)

const applyFilters = () => {
  isLoading.value = true
  updateQueryParams()
  emit('filterChange', {
    ...getFilters(),
    ...getPagination()
  })
  emit('refresh')
  setTimeout(() => {
    isLoading.value = false
  }, 300)
}

const clearFilters = () => {
  resetFilters()
  emit('filterChange', { ...getFilters(), ...getPagination() })
  emit('refresh')
}

watch([dateType, status, startDate, endDate, postFormat, platforms, limit], () => {
  applyFilters()
}, { deep: true })

onMounted(() => {
  initFromQuery()
  initCalendarDates()
  applyFilters()
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 flex-wrap">
        <UButton color="neutral" variant="outline" size="sm" @click="showFilters = !showFilters">
          <Icon name="lucide:filter" class="mr-2 h-4 w-4" />
          Filters
          <UBadge v-if="filtersCount > 0" color="primary" variant="solid" class="ml-2">
            {{ filtersCount }}
          </UBadge>
        </UButton>

        <UButton v-if="hasActiveFilters" color="neutral" variant="ghost" size="xs" @click="clearFilters">
          Clear Filters
          <Icon name="lucide:x" class="ml-1 h-3 w-3" />
        </UButton>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500 hidden sm:inline">Show:</span>
        <USelect v-model="limit" :items="LIMIT_OPTIONS" value-key="value" label-key="label" size="sm" class="w-20" />
      </div>
    </div>

    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100" leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform scale-100 opacity-100" leave-to-class="transform scale-95 opacity-0">
      <div v-if="showFilters" class="flex flex-wrap items-end gap-3 p-4 rounded-lg">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-500">Date Type</label>
          <USelect v-model="dateType" :items="DATE_FILTER_OPTIONS" value-key="value" label-key="label" size="sm"
            class="w-36" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-500">Start Date</label>
          <UPopover>
            <UButton color="neutral" variant="outline" size="sm" class="w-36">
              <Icon name="lucide:calendar" class="mr-2 h-4 w-4" />
              {{ startDate ? formatDateValue(startDateValue) : 'Start' }}
            </UButton>
            <template #content>
              <UCalendar v-model="startDateValue" class="p-2" @update:model-value="onStartDateChange" />
            </template>
          </UPopover>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-500">End Date</label>
          <UPopover>
            <UButton color="neutral" variant="outline" size="sm" class="w-36">
              <Icon name="lucide:calendar" class="mr-2 h-4 w-4" />
              {{ endDate ? formatDateValue(endDateValue) : 'End' }}
            </UButton>
            <template #content>
              <UCalendar v-model="endDateValue" class="p-2" @update:model-value="onEndDateChange" />
            </template>
          </UPopover>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-500">Status</label>
          <USelect v-model="status" :items="STATUS_FILTER_OPTIONS" value-key="value" label-key="label" size="sm"
            class="w-32" />
        </div>

        <div v-if="showPostFormatFilter" class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-500">Post Format</label>
          <USelect v-model="postFormat" :items="POST_FORMAT_OPTIONS" value-key="value" label-key="label" size="sm"
            class="w-28" />
        </div>

        <div v-if="showPlatformFilter" class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-500">Platforms</label>
          <USelectMenu v-model="platforms" :items="PLATFORM_OPTIONS" multiple value-key="value" label-key="label"
            size="sm" class="w-40">
            <UButton color="neutral" variant="ghost" size="sm">
              <Icon name="lucide:globe" class="mr-2 h-4 w-4" />
              {{ platforms.length > 0 ? `${platforms.length} selected` : 'All Platforms' }}
            </UButton>
          </USelectMenu>
        </div>
      </div>
    </Transition>
  </div>
</template>
