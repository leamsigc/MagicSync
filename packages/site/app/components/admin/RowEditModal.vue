<i18n src="./RowEditModal.json"></i18n>

<script lang="ts" setup>
import type { AdminColumnMeta } from '#layers/BaseDB/server/services/admin-data.service'
import { adminEditValue, adminSubmitValues, type AdminFormValues } from '~/utils/admin-data'

const props = defineProps<{
  open: boolean
  tableLabel: string
  columns: AdminColumnMeta[]
  row: Record<string, unknown> | null
  saving: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [values: AdminFormValues]
}>()

const { t } = useI18n()

const open = computed({
  get: () => props.open,
  set: value => emit('update:open', value),
})

const editableColumns = computed(() => props.columns.filter(column => column.editable))

const form = ref<Record<string, unknown>>({})

function buildForm(row: Record<string, unknown> | null): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  if (!row) return next
  for (const column of editableColumns.value) {
    next[column.key] = adminEditValue(column, row[column.key])
  }
  return next
}

watch(
  () => props.row,
  row => {
    form.value = buildForm(row)
  },
  { immediate: true },
)

function toEnumItems(column: AdminColumnMeta) {
  return (column.enumValues ?? []).map(value => ({ label: value, value }))
}

function close() {
  emit('update:open', false)
}

function submit() {
  emit('save', adminSubmitValues(editableColumns.value, form.value))
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('title', { table: tableLabel })"
    :description="t('description')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div class="grid grid-cols-1 gap-4">
        <p v-if="editableColumns.length === 0" class="text-sm text-muted-foreground">
          {{ t('readOnly') }}
        </p>
        <div v-for="column in editableColumns" :key="column.key" class="space-y-1.5">
          <label :for="`admin-field-${column.key}`" class="text-sm font-medium">
            {{ column.label }}
            <span v-if="column.notNull" class="text-destructive">*</span>
          </label>
          <UTextarea
            v-if="column.type === 'textarea'"
            :id="`admin-field-${column.key}`"
            v-model="form[column.key]"
            :rows="5"
            class="w-full"
          />
          <UTextarea
            v-else-if="column.type === 'json'"
            :id="`admin-field-${column.key}`"
            v-model="form[column.key]"
            :rows="6"
            class="w-full font-mono text-xs"
          />
          <USwitch
            v-else-if="column.type === 'boolean'"
            :id="`admin-field-${column.key}`"
            v-model="form[column.key]"
          />
          <USelect
            v-else-if="column.type === 'enum'"
            :id="`admin-field-${column.key}`"
            v-model="form[column.key]"
            :items="toEnumItems(column)"
            class="w-full"
          />
          <UInput
            v-else-if="column.type === 'number'"
            :id="`admin-field-${column.key}`"
            v-model.number="form[column.key]"
            type="number"
            class="w-full"
          />
          <UInput
            v-else-if="column.type === 'datetime'"
            :id="`admin-field-${column.key}`"
            v-model="form[column.key]"
            type="datetime-local"
            class="w-full"
          />
          <UInput
            v-else
            :id="`admin-field-${column.key}`"
            v-model="form[column.key]"
            class="w-full"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="outline" @click="close">
          {{ t('cancel') }}
        </UButton>
        <UButton
          :loading="saving"
          :disabled="editableColumns.length === 0"
          @click="submit"
        >
          <UIcon name="lucide:save" class="mr-2 h-4 w-4" />
          {{ t('save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
