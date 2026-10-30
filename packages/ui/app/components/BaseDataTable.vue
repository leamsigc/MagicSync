<i18n src="./BaseCollection.json"></i18n>
<script lang="ts" setup>
/**
 * The shared table for every collection surface.
 *
 * Presentation only: pages pass rows + column descriptors and render cells
 * through `#cell-<key>` slots, so badges, progress bars and row menus stay in
 * templates (the old `UTable` + `h()` cells could not hold directives).
 *
 * Styling follows the `/app/business` directory table: rounded border, muted
 * header, hover rows, right-aligned actions.
 */
import type { CollectionTableColumn } from '../utils/collection'

interface Props {
  rows: Record<string, any>[]
  columns: CollectionTableColumn[]
  rowKey: string | ((row: Record<string, any>) => string)
  loading?: boolean
  emptyIcon?: string
  emptyTitle?: string
  emptyHint?: string
  minWidth?: string
  selectable?: boolean
  selected?: string[]
  clickable?: boolean
  stickyHeader?: boolean
  sortKey?: string
  sortDir?: 'asc' | 'desc'
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  emptyIcon: 'i-lucide-inbox',
  emptyTitle: '',
  emptyHint: '',
  minWidth: '48rem',
  selectable: false,
  selected: () => [],
  clickable: false,
  stickyHeader: false,
  sortKey: '',
  sortDir: 'asc',
})

const emit = defineEmits<{
  'update:selected': [value: string[]]
  'update:sort': [value: { key: string, dir: 'asc' | 'desc' }]
  'row-click': [row: Record<string, any>]
}>()

const { t } = useI18n()

const hideClass: Record<string, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
}

const alignClass: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

const colspan = computed(() => props.columns.length + (props.selectable ? 1 : 0) + 1)
const rowKeys = computed(() => props.rows.map((row, index) => keyOf(row, index)))
const allSelected = computed(() => rowKeys.value.length > 0 && rowKeys.value.every(key => props.selected.includes(key)))

function keyOf(row: Record<string, any>, index: number): string {
  if (typeof props.rowKey === 'function') return props.rowKey(row)
  const value = row[props.rowKey]
  return value === undefined || value === null ? String(index) : String(value)
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function toggleRow(key: string) {
  const next = props.selected.includes(key)
    ? props.selected.filter(selectedKey => selectedKey !== key)
    : [...props.selected, key]
  emit('update:selected', next)
}

function toggleAll() {
  emit('update:selected', allSelected.value ? [] : [...rowKeys.value])
}

function handleSort(column: CollectionTableColumn) {
  if (!column.sortable) return
  const dir = props.sortKey === column.key && props.sortDir === 'asc' ? 'desc' : 'asc'
  emit('update:sort', { key: column.key, dir })
}

function handleRowClick(row: Record<string, any>) {
  if (props.clickable) emit('row-click', row)
}

function ariaSort(column: CollectionTableColumn): 'ascending' | 'descending' | 'none' {
  if (props.sortKey !== column.key) return 'none'
  return props.sortDir === 'asc' ? 'ascending' : 'descending'
}

function columnClass(column: CollectionTableColumn): string {
  return [alignClass[column.align || 'left'], column.hideBelow ? hideClass[column.hideBelow] : ''].join(' ')
}
</script>

<template>
  <div>
    <div v-if="props.selectable && props.selected.length > 0" class="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-elevated px-3 py-2" v-motion-fade :duration="150">
      <slot name="bulk" :selected="props.selected">
        <span class="text-sm font-medium">{{ t('selected_count', { count: props.selected.length }) }}</span>
        <UButton size="xs" variant="ghost" color="neutral" @click="() => emit('update:selected', [])">
          {{ t('clear_filters') }}
        </UButton>
      </slot>
    </div>

    <div class="overflow-x-auto rounded-2xl border border-default">
      <table class="w-full text-sm" :style="{ minWidth: props.minWidth }">
        <thead :class="props.stickyHeader ? 'sticky top-0 z-10 bg-default' : ''">
          <tr class="border-b border-default text-left text-xs text-muted">
            <th v-if="props.selectable" class="w-10 px-4 py-3">
              <UCheckbox
                :model-value="allSelected"
                :aria-label="t('select_all')"
                @update:model-value="toggleAll"
              />
            </th>
            <th
              v-for="column in props.columns"
              :key="column.key"
              :class="[columnClass(column), 'px-4 py-3 font-medium']"
              :style="column.width ? { width: column.width } : undefined"
              :aria-sort="column.sortable ? ariaSort(column) : undefined"
            >
              <button
                v-if="column.sortable"
                type="button"
                class="inline-flex items-center gap-1 transition-colors hover:text-highlighted"
                @click="() => handleSort(column)"
              >
                {{ column.label }}
                <UIcon
                  :name="props.sortKey === column.key && props.sortDir === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
                  class="size-3.5"
                  :class="props.sortKey === column.key ? 'text-highlighted' : 'text-dimmed'"
                />
              </button>
              <slot v-else :name="`header-${column.key}`" :column="column">
                {{ column.label }}
              </slot>
            </th>
            <th v-if="$slots['row-actions']" class="w-12 px-4 py-3">
              <span class="sr-only">{{ t('actions') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="props.loading">
            <tr v-for="index in 5" :key="`skeleton-${index}`" class="border-b border-default last:border-0">
              <td v-if="props.selectable" class="px-4 py-3">
                <USkeleton class="size-4 rounded" />
              </td>
              <td v-for="column in props.columns" :key="column.key" :class="[columnClass(column), 'px-4 py-3']">
                <USkeleton class="h-4 w-full max-w-40" />
              </td>
              <td v-if="$slots['row-actions']" class="px-4 py-3">
                <USkeleton class="ms-auto size-6 rounded" />
              </td>
            </tr>
          </template>

          <tr v-else-if="props.rows.length === 0">
            <td :colspan="colspan" class="px-4 py-6">
              <BaseCollectionEmpty :icon="props.emptyIcon" :title="props.emptyTitle" :hint="props.emptyHint" :bordered="false">
                <slot name="empty" />
              </BaseCollectionEmpty>
            </td>
          </tr>

          <template v-else>
          <tr
            v-for="(row, index) in props.rows"
            :key="rowKeys[index]"
            class="border-b border-default last:border-0"
            :class="[props.clickable ? 'cursor-pointer' : '', 'hover:bg-accented/40']"
            @click="() => handleRowClick(row)"
          >
            <td v-if="props.selectable" class="px-4 py-3" @click.stop>
              <UCheckbox
                :model-value="props.selected.includes(rowKeys[index] || '')"
                :aria-label="t('select_row')"
                @update:model-value="() => toggleRow(rowKeys[index] || '')"
              />
            </td>
            <td
              v-for="column in props.columns"
              :key="column.key"
              :class="[columnClass(column), 'px-4 py-3']"
            >
              <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]" :index="index">
                {{ display(row[column.key]) }}
              </slot>
            </td>
            <td v-if="$slots['row-actions']" class="px-4 py-3" @click.stop>
              <div class="flex justify-end">
                <slot name="row-actions" :row="row" :index="index" />
              </div>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
    </div>

    <slot name="footer" />
  </div>
</template>
