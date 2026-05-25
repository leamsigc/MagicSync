<i18n src="./MediaGalleryForUser.json"></i18n>
<script lang="ts" setup>
import type { Asset } from '#layers/BaseDB/db/schema';
import { usePexel } from '../composables/usePexel';

interface DownloadPexelImagesResponse {
  success: boolean;
  data: Asset[];
  message: string;
}

const {
  query,
  photos,
  isLoading,
  selectedPhotos,
  searchPhotos,
  goToPage,
  toggleSelectPhoto,
  clearSelectedPhotos,
  totalResults,
  totalPages,
  currentPage,
  perPage,
} = usePexel()

const $emit = defineEmits<{
  (event: 'select-images', assets: Asset[]): void
}>()

const toast = useToast()
const isDownloading = ref(false)

const handleSearch = () => {
  searchPhotos(query.value)
}

const handleUseSelectedImages = async () => {
  if (selectedPhotos.value.length === 0) return
  isDownloading.value = true
  try {
    const response = await $fetch<DownloadPexelImagesResponse>('/api/v1/assets/pexel/download', {
      method: 'POST',
      body: { photos: selectedPhotos.value },
    })
    if (response.success) {
      toast.add({
        title: 'Success',
        description: response.message,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      $emit('select-images', response.data)
      clearSelectedPhotos()
    }
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description: err.data?.statusMessage || err.message || 'Failed to download images',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    isDownloading.value = false
  }
}

const hasResults = computed(() => photos.value.length > 0)
const hasSearched = computed(() => hasResults.value || isLoading.value || query.value.length > 0)

const pageRange = computed(() => {
  const range: number[] = []
  const total = totalPages.value
  const current = currentPage.value
  const start = Math.max(1, current - 2)
  const end = Math.min(total, current + 2)
  for (let i = start; i <= end; i++) {
    range.push(i)
  }
  return range
})
</script>

<template>
  <section class="mt-5">
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
      <UInput v-model="query" :placeholder="t('pexelsSearchPlaceholder')" class="flex-1 min-w-2xs"
        @keyup.enter="handleSearch" />
      <div class="flex items-center gap-2">
        <USelect v-model="perPage" :items="[10, 15, 30, 50]" class="w-24" @update:model-value="searchPhotos()" />
        <UButton @click="handleSearch" :loading="isLoading" icon="lucide:search" color="primary">
          {{ t('search') }}
        </UButton>
      </div>
    </div>

    <div v-if="isLoading && photos.length === 0"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <USkeleton v-for="i in perPage" :key="i" class="aspect-square rounded-lg" />
    </div>

    <div v-else-if="!hasSearched" class="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Icon name="lucide:image" class="w-16 h-16 mb-4 opacity-50" />
      <p class="text-lg">{{ t('pexelsEmptyTitle') }}</p>
      <p class="text-sm">{{ t('pexelsEmptyDescription') }}</p>
    </div>

    <div v-else-if="!hasResults && !isLoading"
      class="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Icon name="lucide:search-x" class="w-16 h-16 mb-4 opacity-50" />
      <p class="text-lg">{{ t('pexelsNoResults') }} "{{ query }}"</p>
      <p class="text-sm">{{ t('pexelsTryDifferent') }}</p>
    </div>

    <div v-else class="space-y-4">
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <UCard v-for="photo in photos" :key="photo.id" :ui="{ body: 'p-0' }"
          :class="['relative cursor-pointer group overflow-hidden rounded-lg', { 'ring-2 ring-primary': selectedPhotos.some((p) => p.id === photo.id) }]">
          <img :src="photo.src.landscape" :alt="photo.alt" class="w-full aspect-square object-cover"
            @click="toggleSelectPhoto(photo)" loading="lazy" />
          <div
            class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            :class="{ 'opacity-100': selectedPhotos.some((p) => p.id === photo.id) }" @click="toggleSelectPhoto(photo)">
            <Icon v-if="selectedPhotos.some((p) => p.id === photo.id)" name="lucide:check-circle"
              class="w-10 h-10 text-primary" />
            <Icon v-else name="lucide:plus-circle" class="w-10 h-10 text-white" />
          </div>
          <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <span class="text-white text-xs truncate block">{{ photo.photographer }}</span>
          </div>
        </UCard>
      </div>

      <div v-if="isLoading" class="flex justify-center py-4">
        <div class="flex items-center gap-3">
          <UIcon name="lucide:loader-circle" class="w-5 h-5 animate-spin" />
          <span class="text-sm text-muted-foreground">{{ t('loading') }}</span>
        </div>
      </div>

      <div v-if="hasResults && totalPages > 1" class="flex items-center justify-between pt-2 border-t">
        <span class="text-xs text-muted-foreground">
          {{ totalResults }} {{ t('results') }}
        </span>
        <div class="flex items-center gap-1">
          <UButton size="sm" color="neutral" variant="ghost" icon="lucide:chevron-first"
            :disabled="currentPage <= 1 || isLoading" @click="goToPage(1)" />
          <UButton size="sm" color="neutral" variant="ghost" icon="lucide:chevron-left"
            :disabled="currentPage <= 1 || isLoading" @click="goToPage(currentPage - 1)" />
          <UButton v-for="page in pageRange" :key="page" size="sm" :color="page === currentPage ? 'primary' : 'neutral'"
            :variant="page === currentPage ? 'solid' : 'ghost'" :disabled="isLoading" @click="goToPage(page)">
            {{ page }}
          </UButton>
          <UButton size="sm" color="neutral" variant="ghost" icon="lucide:chevron-right"
            :disabled="currentPage >= totalPages || isLoading" @click="goToPage(currentPage + 1)" />
          <UButton size="sm" color="neutral" variant="ghost" icon="lucide:chevron-last"
            :disabled="currentPage >= totalPages || isLoading" @click="goToPage(totalPages)" />
        </div>
      </div>

      <div v-if="selectedPhotos.length > 0" class="flex items-center justify-between pt-2 border-t">
        <span class="text-sm text-muted-foreground">
          {{ selectedPhotos.length }} {{ t('imagesSelected') }}
        </span>
        <UButton color="primary" :loading="isDownloading" :disabled="selectedPhotos.length === 0"
          @click="handleUseSelectedImages">
          {{ t('useSelectedImages') }}
        </UButton>
      </div>
    </div>
  </section>
</template>
<style scoped></style>
