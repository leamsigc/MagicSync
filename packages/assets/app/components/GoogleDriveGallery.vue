<i18n src="./MediaGalleryForUser.json"></i18n>
<script lang="ts" setup>
import type { Asset } from '#layers/BaseDB/db/schema';
import { useGoogleDrive } from '../composables/useGoogleDrive';

const {
  files,
  isLoading,
  isDownloading,
  query,
  selectedFiles,
  hasNextPage,
  listFiles,
  loadNextPage,
  toggleSelectFile,
  downloadSelectedFiles,
} = useGoogleDrive()

const { t } = useI18n({ useScope: 'local' })
const $emit = defineEmits<{
  (event: 'select-images', assets: Asset[]): void
}>()

const toast = useToast()
const hasAttemptedLoad = ref(false)

const handleListFiles = async () => {
  hasAttemptedLoad.value = true
  await listFiles()
}

const handleSelectAndDownload = async () => {
  if (selectedFiles.value.length === 0) return
  const assets = await downloadSelectedFiles()
  if (assets.length > 0) {
    $emit('select-images', assets)
  }
}

onMounted(async () => {
  await handleListFiles()
})

const isImageMime = (mimeType: string) => mimeType.startsWith('image/')
const fileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'lucide:image'
  if (mimeType.startsWith('video/')) return 'lucide:video'
  if (mimeType.includes('pdf')) return 'lucide:file-text'
  return 'lucide:file'
}
</script>

<template>
  <section class="mt-5 space-y-4">
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <UInput v-model="query" :placeholder="t('googleDriveSearchPlaceholder')" class="flex-1 min-w-2xs"
        @keyup.enter="handleListFiles" />
      <UButton @click="handleListFiles" :loading="isLoading" icon="lucide:search" color="primary">
        {{ t('search') }}
      </UButton>
    </div>

    <div v-if="isLoading && files.length === 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      <USkeleton v-for="i in 6" :key="i" class="aspect-square rounded-lg" />
    </div>

    <div v-else-if="!hasAttemptedLoad || (files.length === 0 && !isLoading)"
      class="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Icon name="lucide:folder-open" class="w-16 h-16 mb-4 opacity-50" />
      <p class="text-lg">{{ t('googleDriveEmpty') }}</p>
    </div>

    <div v-else class="space-y-4">
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <UCard v-for="file in files" :key="file.id" :ui="{ body: 'p-0' }"
          :class="['relative cursor-pointer group overflow-hidden rounded-lg', { 'ring-2 ring-primary': selectedFiles.some((f) => f.id === file.id) }]">
          <div class="aspect-square relative" @click="toggleSelectFile(file)">
            <img v-if="isImageMime(file.mimeType) && file.thumbnailLink" :src="file.thumbnailLink" :alt="file.name"
              class="w-full h-full object-cover" loading="lazy" />
            <div v-else class="w-full h-full flex items-center justify-center bg-muted">
              <Icon :name="fileIcon(file.mimeType)" class="w-12 h-12 text-muted-foreground" />
            </div>
            <div
              class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              :class="{ 'opacity-100': selectedFiles.some((f) => f.id === file.id) }">
              <Icon v-if="selectedFiles.some((f) => f.id === file.id)" name="lucide:check-circle"
                class="w-10 h-10 text-primary" />
              <Icon v-else name="lucide:plus-circle" class="w-10 h-10 text-white" />
            </div>
          </div>
          <div class="p-2">
            <p class="text-xs truncate">{{ file.name }}</p>
            <p v-if="file.size" class="text-[10px] text-muted-foreground">{{ (Number(file.size) / 1024 /
              1024).toFixed(1) }} MB</p>
          </div>
        </UCard>
      </div>

      <div v-if="hasNextPage" class="flex justify-center">
        <UButton color="neutral" variant="outline" :loading="isLoading" @click="loadNextPage">
          {{ t('loadMore') }}
        </UButton>
      </div>

      <div v-if="selectedFiles.length > 0" class="flex items-center justify-between pt-2 border-t">
        <span class="text-sm text-muted-foreground">
          {{ selectedFiles.length }} {{ t('filesSelected') }}
        </span>
        <UButton color="primary" :loading="isDownloading" :disabled="selectedFiles.length === 0"
          @click="handleSelectAndDownload">
          {{ t('downloadToAssets') }}
        </UButton>
      </div>
    </div>
  </section>
</template>
<style scoped></style>
