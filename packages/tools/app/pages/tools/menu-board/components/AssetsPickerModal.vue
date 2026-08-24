<script setup lang="ts">
/**
 *
 * AssetsPickerModal — lets logged-in users pick an image from their
 * uploaded assets (media library) as the content of a board page.
 *
 */
interface AssetItem {
  id: string
  originalName?: string
  filename?: string
  mimeType?: string
  url: string
  thumbnailUrl?: string | null
}

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ select: [url: string] }>()

const assets = ref<AssetItem[]>([])
const isLoading = ref(false)
const hasLoaded = ref(false)

async function loadAssets(): Promise<void> {
  isLoading.value = true
  try {
    const res = await $fetch<{ success: boolean; data: AssetItem[] }>('/api/v1/assets', {
      params: { own: 'true', limit: 60 },
    })
    assets.value = (res.data ?? []).filter(a => (a.mimeType ?? 'image').startsWith('image/'))
  } catch {
    assets.value = []
  } finally {
    isLoading.value = false
    hasLoaded.value = true
  }
}

watch(open, (isOpen) => {
  if (isOpen && !hasLoaded.value) void loadAssets()
})

function pick(asset: AssetItem): void {
  emit('select', asset.url)
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :ui="{ content: 'max-w-2xl' }">
    <template #content>
      <div class="p-6" data-testid="assets-picker">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold tracking-tight">Choose from your assets</h2>
          <UButton variant="ghost" color="neutral" icon="i-lucide-x" @click="() => { open = false }" />
        </div>

        <div v-if="isLoading" class="py-16 text-center text-muted-foreground">Loading your media...</div>

        <div v-else-if="assets.length === 0"
          class="py-16 text-center text-muted-foreground" data-testid="assets-empty">
          No image assets found. Upload some in the Media section first.
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[65vh] overflow-y-auto pr-1">
          <button v-for="asset in assets" :key="asset.id"
            class="aspect-video rounded-xl overflow-hidden border-2 border-border hover:border-primary transition-all cursor-pointer group relative bg-muted"
            :data-testid="`asset-item-${asset.id}`" @click="pick(asset)">
            <img :src="asset.thumbnailUrl || asset.url" :alt="asset.originalName || asset.filename || 'Asset'"
              class="w-full h-full object-cover">
            <span
              class="absolute inset-x-0 bottom-0 px-2 py-1 text-xs text-white bg-black/50 truncate opacity-0 group-hover:opacity-100 transition-opacity">
              {{ asset.originalName || asset.filename }}
            </span>
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>
