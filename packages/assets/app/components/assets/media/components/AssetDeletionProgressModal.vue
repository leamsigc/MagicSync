<i18n src="./AssetDeletionProgressModal.json"></i18n>

<script lang="ts" setup>

import type { AssetDeletionItem } from '#layers/BaseAssets/app/composables/useAssetManagement'

const { t } = useI18n()
const toast = useToast()
const { deletionItems, isDeletingAssets, clearDeletionHistory } = useAssetManagement()
const { formatFileSize } = useAsset()

const isOpen = ref(false)
const isMinimized = ref(false)

let finishTimer: ReturnType<typeof setTimeout> | null = null

const total = computed(() => deletionItems.value.length)
const deletedCount = computed(() => deletionItems.value.filter(item => item.status === 'deleted').length)
const failedCount = computed(() => deletionItems.value.filter(item => item.status === 'error').length)
const settledCount = computed(() => deletedCount.value + failedCount.value)
const percent = computed(() => (total.value === 0 ? 0 : Math.round((settledCount.value / total.value) * 100)))
const isDone = computed(() => total.value > 0 && settledCount.value === total.value)

function clearFinishTimer() {
  if (finishTimer) {
    clearTimeout(finishTimer)
    finishTimer = null
  }
}

function announceBatchResult() {
  const plural = deletedCount.value === 1 ? '' : 's'
  if (failedCount.value === 0) {
    toast.add({
      title: t('toasts.success_title'),
      description: t('toasts.success', { count: deletedCount.value, plural }),
      color: 'success',
    })
    return
  }
  toast.add({
    title: t('toasts.partial_title'),
    description: t('toasts.partial', { deleted: deletedCount.value, failed: failedCount.value }),
    color: 'warning',
  })
}

function resetAfterBatch() {
  isOpen.value = false
  isMinimized.value = false
  clearDeletionHistory()
}

function completeBatch() {
  announceBatchResult()
  clearFinishTimer()
  finishTimer = setTimeout(resetAfterBatch, 1800)
}

watch(isDeletingAssets, (deleting, wasDeleting) => {
  if (deleting) {
    clearFinishTimer()
    isMinimized.value = false
    isOpen.value = true
    return
  }
  if (wasDeleting) {
    completeBatch()
  }
})

function minimizeModal() {
  isMinimized.value = true
  isOpen.value = false
}

function reopenModal() {
  clearFinishTimer()
  isMinimized.value = false
  isOpen.value = true
}

function closeModal() {
  clearFinishTimer()
  resetAfterBatch()
}

function handleOpenChange(value: boolean) {
  if (value) {
    reopenModal()
    return
  }
  if (isDeletingAssets.value) {
    minimizeModal()
    return
  }
  closeModal()
}

function statusIcon(status: AssetDeletionItem['status']) {
  if (status === 'deleted') return 'lucide:check'
  if (status === 'error') return 'lucide:alert-circle'
  if (status === 'deleting') return 'lucide:loader-circle'
  return 'lucide:clock'
}

function statusClass(status: AssetDeletionItem['status']) {
  if (status === 'error') return 'text-destructive'
  if (status === 'deleted') return 'text-success'
  return 'text-muted-foreground'
}

onBeforeUnmount(clearFinishTimer)
</script>

<template>
  <button v-if="isMinimized && total > 0" v-motion-slide-bottom :duration="250" type="button"
    class="fixed bottom-4 end-4 z-50 flex items-center gap-3 rounded-full bg-elevated px-4 py-2 shadow-lg transition-shadow hover:shadow-xl"
    :aria-label="t('pill.open')" @click="reopenModal">
    <UIcon :name="isDone ? 'lucide:check-circle' : 'lucide:loader-circle'"
      class="size-4 text-primary" :class="{ 'animate-spin': !isDone }" />
    <span class="text-sm font-medium">
      {{ t('pill.label', { done: settledCount, total }) }}
    </span>
    <UIcon name="lucide:chevron-up" class="size-4 text-muted-foreground" />
  </button>

  <UModal :open="isOpen" @update:open="handleOpenChange">
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon :name="isDone ? 'lucide:check-circle' : 'lucide:trash-2'"
          class="size-6" :class="isDone ? 'text-success' : 'text-destructive'" />
        <div>
          <h3 class="font-semibold">{{ isDone ? t('title_done') : t('title') }}</h3>
          <p class="text-sm text-muted-foreground">{{ t('subtitle') }}</p>
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="space-y-2">
          <div class="flex items-center justify-between text-sm" aria-live="polite">
            <span class="text-muted-foreground">{{ t('progress', { done: settledCount, total }) }}</span>
            <span class="font-medium">{{ percent }}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full transition-all duration-300"
              :class="isDone && failedCount > 0 ? 'bg-warning' : 'bg-primary'"
              :style="{ width: `${percent}%` }" />
          </div>
        </div>

        <ul class="max-h-64 space-y-2 overflow-y-auto">
          <li v-for="item in deletionItems" :key="item.id" class="flex items-center gap-3 text-sm">
            <UIcon :name="statusIcon(item.status)" class="size-4 shrink-0"
              :class="[statusClass(item.status), { 'animate-spin': item.status === 'deleting' }]" />
            <span class="min-w-0 flex-1 truncate">{{ item.name }}</span>
            <span class="shrink-0 text-xs text-muted-foreground">{{ formatFileSize(item.size) }}</span>
            <span v-if="item.status === 'error'" class="max-w-[180px] shrink-0 truncate text-xs text-destructive"
              :title="item.error">
              {{ item.error }}
            </span>
          </li>
        </ul>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton v-if="!isDone" variant="outline" @click="minimizeModal">
          <UIcon name="lucide:minus" class="mr-2 size-4" />
          {{ t('run_in_background') }}
        </UButton>
        <UButton v-else variant="outline" @click="closeModal">
          {{ t('close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
