<i18n src="./BaseCollection.json"></i18n>
<script lang="ts" setup>
/**
 * Bordered collection list. The `#item` slot renders the row content; the
 * wrapper supplies the shared padding, divider and hover treatment so list
 * rows look identical on every page.
 */
interface Props {
  items: Record<string, any>[]
  rowKey: string | ((item: Record<string, any>) => string)
  loading?: boolean
  emptyIcon?: string
  emptyTitle?: string
  emptyHint?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  emptyIcon: 'i-lucide-inbox',
  emptyTitle: '',
  emptyHint: '',
})

function keyOf(item: Record<string, any>, index: number): string {
  if (typeof props.rowKey === 'function') return props.rowKey(item)
  const value = item[props.rowKey]
  return value === undefined || value === null ? String(index) : String(value)
}
</script>

<template>
  <div v-if="props.loading" class="overflow-hidden rounded-2xl border border-default">
    <div v-for="index in 5" :key="`skeleton-${index}`" class="flex items-center gap-3 border-b border-default px-4 py-3 last:border-0">
      <USkeleton class="size-9 rounded-lg" />
      <div class="flex-1 space-y-1.5">
        <USkeleton class="h-3.5 w-40" />
        <USkeleton class="h-3 w-64 max-w-full" />
      </div>
    </div>
  </div>

  <BaseCollectionEmpty v-else-if="props.items.length === 0" :icon="props.emptyIcon" :title="props.emptyTitle" :hint="props.emptyHint">
    <slot name="empty" />
  </BaseCollectionEmpty>

  <div v-else class="overflow-hidden rounded-2xl border border-default" v-motion-fade :duration="200">
    <div
      v-for="(item, index) in props.items"
      :key="keyOf(item, index)"
      class="flex items-center gap-3 border-b border-default px-4 py-3 last:border-0 hover:bg-accented/40"
    >
      <slot name="item" :item="item" :index="index" />
    </div>
  </div>
</template>
