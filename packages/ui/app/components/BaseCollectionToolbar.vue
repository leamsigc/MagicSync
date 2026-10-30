<i18n src="./BaseCollection.json"></i18n>
<script lang="ts" setup>
/**
 * One toolbar for every collection page: search, declarative filters, sort and
 * the view switcher. Pages own the data; this component only reports changes
 * (`update:search`, `update:filter`, `update:sort`, `update:modelValue`).
 */
import type { CollectionFilter, CollectionSort } from '../utils/collection'

interface Props {
  search?: string
  searchPlaceholder?: string
  filters?: CollectionFilter[]
  sort?: CollectionSort | null
  view?: string
  views?: Array<{ value: string, label: string, icon: string }>
  busy?: boolean
  showSearch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  search: '',
  searchPlaceholder: '',
  filters: () => [],
  sort: null,
  view: '',
  views: () => [],
  busy: false,
  showSearch: true,
})

const emit = defineEmits<{
  'update:search': [value: string]
  'update:view': [value: string]
  'update:sort': [value: string]
  'update:filter': [key: string, value: string]
}>()

const { t } = useI18n()

function handleSearch(value: string) {
  emit('update:search', value)
}

function handleView(value: string) {
  emit('update:view', value)
}

function handleSort(value: string) {
  emit('update:sort', value)
}

function handleFilter(key: string, value: string) {
  emit('update:filter', key, value)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <template v-if="props.showSearch">
      <UInput
        :model-value="props.search"
        icon="i-lucide-search"
        :placeholder="props.searchPlaceholder || t('search_placeholder')"
        :loading="props.busy"
        class="w-full sm:w-64"
        @update:model-value="handleSearch"
      />
    </template>

    <USelect
      v-for="filter in props.filters"
      :key="filter.key"
      :model-value="filter.value"
      :items="filter.options"
      value-key="value"
      label-key="label"
      :aria-label="filter.label || filter.key"
      :class="filter.width || 'w-full sm:w-44'"
      @update:model-value="(value: string) => handleFilter(filter.key, value)"
    />

    <USelect
      v-if="props.sort"
      :model-value="props.sort.value"
      :items="props.sort.options"
      value-key="value"
      label-key="label"
      :aria-label="t('sort_label')"
      class="w-full sm:w-52"
      @update:model-value="handleSort"
    />

    <slot name="start" />

    <div class="ms-auto flex items-center gap-2">
      <slot name="end" />
      <BaseViewSwitcher :model-value="props.view" :options="props.views" :disabled="props.busy" @update:model-value="handleView" />
    </div>
  </div>
</template>
