<script lang="ts" setup>
/**
 *
 * Component Description: Modal to search images in Pexels, display results, and allow selection.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

import type { Asset } from '#layers/BaseDB/db/schema';
import { useScroll } from '@vueuse/core';
import { usePexel } from '../composables/usePexel';

interface PexelsPhoto { // Moved PexelsPhoto interface here for local use
  id: number
  width: number
  height: number
  url: string
  photographer: string
  photographer_url: string
  photographer_id: number
  avg_color: string
  src: {
    original: string
    large2x: string
    large: string
    medium: string
    small: string
    portrait: string
    landscape: string
    tiny: string
  }
  liked: boolean
  alt: string
}

interface DownloadPexelImagesResponse {
  success: boolean;
  data: Asset[];
  message: string;
}

const isOpen = defineModel('isOpen', { type: Boolean, default: false })

const {
  query,
  photos,
  isLoading,
  selectedPhotos,
  searchPhotos,
  loadMore,
  toggleSelectPhoto,
  clearSelectedPhotos,
} = usePexel()

const $emit = defineEmits<{
  (event: 'select-images', assets: Asset[]): void
}>()

const hasInitialSearchBeenPerformed = computed(() => photos.value.length > 0 || isLoading.value || query.value.length > 0)

const handleSearch = () => {
  searchPhotos(query.value)
}

const handleUseSelectedImages = async () => {
  const { data, error } = await useFetch<DownloadPexelImagesResponse>('/api/v1/assets/pexel/download', {
    method: 'POST',
    body: { photos: selectedPhotos.value },
  })

  if (error.value) {
    console.error('Error downloading Pexels images:', error.value)
    return
  }

  if (data.value && data.value.success) {
    $emit('select-images', data.value.data)
    isOpen.value = false
    clearSelectedPhotos()
  }
}

// Infinite scroll
const scrollContainer = ref<HTMLElement | null>(null)
const { arrivedState } = useScroll(scrollContainer)

watch(
  () => arrivedState.bottom,
  (isBottom) => {
    if (isBottom && !isLoading.value) {
      loadMore()
    }
  },
)
</script>

<template>
  <section class="flex items-center gap-2 w-full">
    <UInput v-model="query" placeholder="Search for photos (e.g., 'minimalist office')" class="flex-1 min-w-2xs"
      @keyup.enter="handleSearch" />
    <UModal v-model:open="isOpen" fullscreen
      :ui="{ wrapper: 'relative z-50', body: 'flex min-h-full items-center justify-center text-center' }">
      <div class="flex items-center gap-2 w-full">
        <UButton @click="handleSearch" :loading="isLoading" icon="i-heroicons-magnifying-glass" color="primary">
          Search
        </UButton>
        <UButton variant="ghost" icon="i-heroicons-x-mark-20-solid" class="-my-1" @click="isOpen = false" />
      </div>
      <template #content>
        <UCard :ui="{
          root: 'h-full flex flex-col',
          body: 'relative flex-1 overflow-auto p-4 sm:p-6',
          header: 'flex items-center justify-between-4 sm:p-6'
          ,
          footer: 'shrink-0 flex justify-end gap-2 p-4 sm:p-6'
        }">
          <template #header>
            <div class="flex items-center gap-2 w-full">
              <UInput v-model="query" placeholder="Search for photos (e.g., 'minimalist office')" class="flex-1"
                @keyup.enter="handleSearch" />
              <UButton @click="handleSearch" :loading="isLoading" icon="i-heroicons-magnifying-glass" color="primary">
                Search
              </UButton>
              <UButton variant="ghost" icon="i-heroicons-x-mark-20-solid" class="-my-1" @click="isOpen = false" />
            </div>
          </template>

          <div ref="scrollContainer" class="flex-1 overflow-y-auto">
            <div v-if="!hasInitialSearchBeenPerformed"
              class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <UIcon name="i-heroicons-magnifying-glass" class="w-16 h-16 mb-4" />
              <p class="text-lg">Enter a search term to find photos</p>
              <p class="text-sm">Try "Nature", "Business", or "Abstract"</p>
            </div>
            <div v-else-if="photos.length === 0 && !isLoading"
              class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <UIcon name="i-heroicons-exclamation-circle" class="w-16 h-16 mb-4" />
              <p class="text-lg">No photos found for "{{ query }}"</p>
              <p class="text-sm">Try a different search term.</p>
            </div>
            <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <UCard v-for="photo in photos" :key="photo.id" :ui="{ body: 'p-0 sm:p-0' }"
                :class="['relative cursor-pointer group', { 'ring-2 ring-primary': selectedPhotos.some((p: PexelsPhoto) => p.id === photo.id) }]">
                <img :src="photo.src.landscape" :alt="photo.alt" class="w-full h-48 object-cover rounded-md"
                  @click="toggleSelectPhoto(photo)" />
                <div
                  class="absolute inset-0 bg-black/50  flex items-center justify-center  group-hover:opacity-100 transition-opacity duration-200"
                  :class="{ 'opacity-0': !selectedPhotos.some((p: PexelsPhoto) => p.id === photo.id) }"
                  @click="toggleSelectPhoto(photo)">
                  <UIcon v-if="selectedPhotos.some((p: PexelsPhoto) => p.id === photo.id)"
                    name="i-heroicons-check-circle-solid" class="w-10 h-10 text-primary-400" />
                  <UIcon v-else name="i-heroicons-plus-circle-solid" class="w-10 h-10 text-white" />
                </div>
                <div class="absolute bottom-2 left-2 text-white text-xs bg-black  px-2 py-1 rounded-md">
                  {{ photo.photographer }}
                </div>
              </UCard>
            </div>
            <div v-if="isLoading" class="flex justify-center py-4">
              <div class="flex items-center gap-4">
                <USkeleton class="h-12 w-12 rounded-full" />
                <div class="grid gap-2">
                  <USkeleton class="h-4 w-[250px]" />
                  <USkeleton class="h-4 w-[200px]" />
                </div>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex items-center justify-between w-full">
              <span v-if="selectedPhotos.length > 0" class="text-sm text-gray-500 dark:text-gray-400">
                {{ selectedPhotos.length }} image(s) selected
              </span>
              <span v-else></span>
              <div class="flex gap-2">
                <UButton variant="solid" @click="isOpen = false">
                  Cancel
                </UButton>
                <UButton color="primary" @click="handleUseSelectedImages" :disabled="selectedPhotos.length === 0">
                  Use Selected Images
                </UButton>
              </div>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </section>
</template>

<style scoped></style>
