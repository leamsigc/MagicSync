<i18n src="./BulkDeleteModal.json"></i18n>

<script lang="ts" setup>
const props = defineProps<{
  open: boolean
  tableLabel: string
  count: number
  busy: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

const { t } = useI18n()

const open = computed({
  get: () => props.open,
  set: value => emit('update:open', value),
})

function close() {
  emit('update:open', false)
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('title')"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <div class="flex items-start gap-3">
        <div class="rounded-lg bg-error/10 p-2">
          <UIcon name="lucide:triangle-alert" class="h-5 w-5 text-error" />
        </div>
        <div class="space-y-1">
          <p class="text-sm">
            {{ t('question', { count, table: tableLabel }) }}
          </p>
          <p class="text-xs text-muted-foreground">{{ t('warning') }}</p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="outline" @click="close">
          {{ t('cancel') }}
        </UButton>
        <UButton color="error" :loading="busy" @click="emit('confirm')">
          <UIcon name="lucide:trash-2" class="mr-2 h-4 w-4" />
          {{ t('confirm') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
