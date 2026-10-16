<i18n src="./RowDetailModal.json"></i18n>

<script lang="ts" setup>
import type { AdminColumnMeta } from '#layers/BaseDB/server/services/admin-data.service'
import { formatAdminCellValue, formatAdminJson } from '~/utils/admin-data'

const props = defineProps<{
  open: boolean
  tableLabel: string
  columns: AdminColumnMeta[]
  row: Record<string, unknown> | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  edit: []
  remove: []
}>()

const { t } = useI18n()

const open = computed({
  get: () => props.open,
  set: value => emit('update:open', value),
})

const hasEditable = computed(() => props.columns.some(column => column.editable))

function rowValue(column: AdminColumnMeta): string {
  if (!props.row) return ''
  if (column.type === 'json') return formatAdminJson(props.row[column.key], true)
  return formatAdminCellValue(column, props.row[column.key])
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('title', { table: tableLabel })"
    :description="t('description')"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div class="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        <div v-for="column in columns" :key="column.key" class="space-y-0.5">
          <p class="text-xs tracking-wide text-muted-foreground uppercase">{{ column.label }}</p>
          <pre
            v-if="column.type === 'json'"
            class="overflow-x-auto rounded bg-elevated p-2 font-mono text-xs"
          >{{ rowValue(column) }}</pre>
          <p v-else class="text-sm break-all">{{ rowValue(column) }}</p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="error" variant="outline" @click="emit('remove')">
          <UIcon name="lucide:trash-2" class="mr-2 h-4 w-4" />
          {{ t('delete') }}
        </UButton>
        <UButton :disabled="!hasEditable" @click="emit('edit')">
          <UIcon name="lucide:pencil" class="mr-2 h-4 w-4" />
          {{ t('edit') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
