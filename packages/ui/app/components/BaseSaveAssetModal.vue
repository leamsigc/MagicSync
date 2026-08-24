<i18n src="./BaseSaveAssetModal.json"></i18n>

<script lang="ts" setup>
export interface SavedAsset {
  id: string
  url?: string
  originalName?: string
  mimeType?: string
}

const props = withDefaults(defineProps<{
  filename: string
  accept?: 'blob' | 'dataUrl' | 'file'
  payload?: Blob | File | string | null
}>(), {
  accept: 'dataUrl',
  payload: null
})

const isOpen = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  saved: [asset: SavedAsset]
}>()

const { t } = useI18n()
const toast = useToast()

const isSaving = ref(false)
const assetName = ref(props.filename)
const errorMessage = ref<string | null>(null)

watch(() => props.filename, (name) => {
  assetName.value = name
})

watch(isOpen, (val) => {
  if (val) {
    assetName.value = props.filename
    errorMessage.value = null
  }
})

function buildFile(): File | null {
  const name = assetName.value.trim()
  if (!name || !props.payload) return null

  if (props.accept === 'file') {
    if (!(props.payload instanceof File)) return null
    return new File([props.payload], name, { type: props.payload.type })
  }

  if (props.accept === 'blob') {
    return new File([props.payload as Blob], name, { type: (props.payload as Blob).type || 'image/png' })
  }

  const dataUrl = String(props.payload)
  const [meta, base64] = dataUrl.split(',')
  const mime = meta?.match(/:(.*?);/)?.[1] || 'image/png'
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  return new File([bytes], name, { type: mime })
}

async function handleConfirm() {
  const file = buildFile()
  if (!file) return
  isSaving.value = true
  errorMessage.value = null
  try {
    const formData = new FormData()
    formData.append('files', file)
    const response = await $fetch<{ success: boolean; data: SavedAsset[] }>('/api/v1/assets', {
      method: 'POST',
      body: formData
    })
    const asset = response.data?.[0]
    if (!asset?.id) {
      throw new Error(t('errors.generic'))
    }
    toast.add({
      title: t('messages.savedTitle'),
      description: t('messages.savedDescription'),
      icon: 'i-heroicons-check-circle',
      color: 'success'
    })
    emit('saved', asset)
    isOpen.value = false
  } catch (err) {
    const fetchError = err as { status?: number; statusCode?: number; data?: { message?: string }; message?: string }
    const status = fetchError?.status ?? fetchError?.statusCode
    if (status === 401 || status === 403) {
      errorMessage.value = t('errors.unauthorized')
      toast.add({
        title: t('errors.unauthorized'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'warning'
      })
    } else {
      errorMessage.value = fetchError?.data?.message || fetchError?.message || t('errors.generic')
      toast.add({
        title: t('errors.uploadFailedTitle'),
        description: errorMessage.value,
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error'
      })
    }
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="p-4 space-y-4">
        <section>
          <h3 class="font-semibold text-foreground">{{ t('title') }}</h3>
          <p class="text-sm text-muted mt-1">{{ t('description') }}</p>
        </section>

        <label class="block text-sm font-medium text-highlighted" for="base-save-asset-name">
          {{ t('nameLabel') }}
        </label>
        <UInput
          id="base-save-asset-name"
          v-model="assetName"
          :placeholder="'my-design.png'"
          block
          :disabled="isSaving"
        />

        <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>
      </div>
      <div class="flex justify-end gap-2 p-4 pt-0">
        <UButton variant="outline" color="neutral" :disabled="isSaving" @click="() => { isOpen = false }">
          {{ t('actions.cancel') }}
        </UButton>
        <UButton :loading="isSaving" :disabled="!assetName.trim()" @click="handleConfirm">
          {{ t('actions.confirm') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
