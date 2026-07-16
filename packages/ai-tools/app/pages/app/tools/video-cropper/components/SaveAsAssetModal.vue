<i18n src="../index.json"></i18n>

<script lang="ts" setup>
const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  save: [name: string]
  download: []
}>()

const { t } = useI18n()
const assetName = ref(`magic_sync_video_${Date.now()}.mp4`)
const isSaving = ref(false)

async function handleSave() {
  if (!assetName.value.trim()) return
  isSaving.value = true
  emit('save', assetName.value.trim())
}

function handleDownload() {
  emit('download')
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>

      <div class="p-4 space-y-4">
        <section>
          {{ t('actions.save_as_asset') }}
          <p>
            {{ t('notifications.export_complete_desc') }}
          </p>
        </section>

        <label class="text-sm font-medium text-gray-300">{{ t('actions.save_as_asset') }}</label>
        <UInput
        v-model="assetName"
        :placeholder="'my-cropped-video.mp4'"
        block
        />
      </div>
      <div class="flex justify-between gap-2">
        <UButton variant="outline" @click="handleDownload" icon="i-lucide-download">
          Download
        </UButton>
        <div class="flex gap-2">
          <UButton variant="outline" @click="()=>{isOpen = false}">
            {{ t('actions.cancel') }}
          </UButton>
          <UButton :loading="isSaving" :disabled="!assetName.trim()" @click="handleSave">
            {{ t('actions.confirm') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
