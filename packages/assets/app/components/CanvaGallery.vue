<i18n src="./MediaGalleryForUser.json"></i18n>
<script lang="ts" setup>
import type { Asset } from '#layers/BaseDB/db/schema';
import { useCanva } from '../composables/useCanva';

const {
  assets,
  isLoading,
  isDownloading,
  query,
  selectedAssets,
  hasNextPage,
  listAssets,
  loadNextPage,
  toggleSelectAsset,
  downloadSelectedAssets,
} = useCanva()

const $emit = defineEmits<{
  (event: 'select-images', assets: Asset[]): void
}>()

const hasAttemptedLoad = ref(false)

const handleListAssets = async () => {
  hasAttemptedLoad.value = true
  await listAssets()
}

const handleSelectAndDownload = async () => {
  if (selectedAssets.value.length === 0) return
  const downloaded = await downloadSelectedAssets()
  if (downloaded.length > 0) {
    $emit('select-images', downloaded)
  }
}

onMounted(async () => {
  await handleListAssets()
})
</script>

<template>
  <section class="mt-5 space-y-4">
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <UInput v-model="query" :placeholder="t('canvaSearchPlaceholder')" class="flex-1 min-w-2xs"
        @keyup.enter="handleListAssets" />
      <UButton @click="handleListAssets" :loading="isLoading" icon="lucide:search" color="primary">
        {{ t('search') }}
      </UButton>
    </div>

    <div v-if="isLoading && assets.length === 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      <USkeleton v-for="i in 6" :key="i" class="aspect-square rounded-lg" />
    </div>

    <div v-else-if="!hasAttemptedLoad || (assets.length === 0 && !isLoading)"
      class="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Icon name="lucide:brush" class="w-16 h-16 mb-4 opacity-50" />
      <p class="text-lg">{{ t('canvaEmpty') }}</p>
      <p class="text-sm">{{ t('canvaEmptyDescription') }}</p>
    </div>

    <div v-else class="space-y-4">
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <UCard v-for="asset in assets" :key="asset.id" :ui="{ body: 'p-0' }"
          :class="['relative cursor-pointer group overflow-hidden rounded-lg', { 'ring-2 ring-primary': selectedAssets.some((a) => a.id === asset.id) }]">
          <div class="aspect-square relative" @click="toggleSelectAsset(asset)">
            <img :src="asset.thumbnailUrl" :alt="asset.name" class="w-full h-full object-cover" loading="lazy" />
            <div
              class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              :class="{ 'opacity-100': selectedAssets.some((a) => a.id === asset.id) }">
              <Icon v-if="selectedAssets.some((a) => a.id === asset.id)" name="lucide:check-circle"
                class="w-10 h-10 text-primary" />
              <Icon v-else name="lucide:plus-circle" class="w-10 h-10 text-white" />
            </div>
          </div>
          <div class="p-2">
            <p class="text-xs truncate">{{ asset.name }}</p>
            <p class="text-[10px] text-muted-foreground capitalize">{{ asset.type }}</p>
          </div>
        </UCard>
      </div>

      <div v-if="hasNextPage" class="flex justify-center">
        <UButton color="neutral" variant="outline" :loading="isLoading" @click="loadNextPage">
          {{ t('loadMore') }}
        </UButton>
      </div>

      <div v-if="selectedAssets.length > 0" class="flex items-center justify-between pt-2 border-t">
        <span class="text-sm text-muted-foreground">
          {{ selectedAssets.length }} {{ t('canvaAssetsSelected') }}
        </span>
        <UButton color="primary" :loading="isDownloading" :disabled="selectedAssets.length === 0"
          @click="handleSelectAndDownload">
          {{ t('downloadToAssets') }}
        </UButton>
      </div>
    </div>
  </section>
</template>
<style scoped></style>
