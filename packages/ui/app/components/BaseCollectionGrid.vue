<i18n src="./BaseCollection.json"></i18n>
<script lang="ts" setup>
/**
 * Responsive collection grid. Pages render the card through `#item`; this
 * component owns the column count, motion, loading skeletons and empty state.
 */
interface Props {
  items: Record<string, any>[]
  rowKey: string | ((item: Record<string, any>) => string)
  /** 3 (default) or 4 columns at xl. */
  columns?: 3 | 4
  loading?: boolean
  emptyIcon?: string
  emptyTitle?: string
  emptyHint?: string
}

const props = withDefaults(defineProps<Props>(), {
  columns: 3,
  loading: false,
  emptyIcon: 'i-lucide-inbox',
  emptyTitle: '',
  emptyHint: '',
})

const { t } = useI18n()

const gridClass = computed(() => props.columns === 4
  ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  : 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3')

function keyOf(item: Record<string, any>, index: number): string {
  if (typeof props.rowKey === 'function') return props.rowKey(item)
  const value = item[props.rowKey]
  return value === undefined || value === null ? String(index) : String(value)
}
</script>

<template>
  <div v-if="props.loading" :class="gridClass">
    <USkeleton v-for="index in 6" :key="`skeleton-${index}`" class="h-40 rounded-2xl" />
  </div>

  <BaseCollectionEmpty v-else-if="props.items.length === 0" :icon="props.emptyIcon" :title="props.emptyTitle" :hint="props.emptyHint">
    <slot name="empty" />
  </BaseCollectionEmpty>

  <div v-else :class="gridClass" v-motion-fade :duration="200">
    <template v-for="(item, index) in props.items" :key="keyOf(item, index)">
      <slot name="item" :item="item" :index="index" />
    </template>
  </div>
</template>
