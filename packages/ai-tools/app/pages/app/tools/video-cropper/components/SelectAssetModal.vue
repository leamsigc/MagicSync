<i18n src="../index.json"></i18n>

<script lang="ts" setup>
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  select: [assetUrl: string, assetName: string]
}>()

const { t } = useI18n()
const selectedAssets = ref<any[]>([])

function confirmSelection() {
  if (selectedAssets.value.length > 0) {
    const asset = selectedAssets.value[0]
    emit('select', asset.url || `/api/v1/assets/serve/${asset.id}`, asset.originalName || asset.filename)
    isOpen.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" size="3xl">
    <template #title>
      {{ t('actions.select_video') }}
    </template>
    <template #description>
      {{ t('actions.select_from_assets') }}
    </template>
    <template #content>
      <div class="p-4">
        <MediaGalleryForUser v-model:selected="selectedAssets" />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="outline" @click="() => { isOpen = !isOpen }">
          {{ t('actions.cancel') }}
        </UButton>
        <UButton :disabled="selectedAssets.length === 0" @click="confirmSelection">
          {{ t('actions.select_video') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
