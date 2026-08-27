<script lang="ts" setup>
interface SavedCarousel {
  id: string
  name: string
  slides: unknown[]
  isPublic?: boolean
  updatedAt?: string
}

defineProps<{
  carousels: SavedCarousel[]
}>()

const emit = defineEmits<{
  edit: [carousel: SavedCarousel]
  delete: [id: string]
}>()

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div v-if="carousels.length === 0" class="text-center py-24 text-muted">
    <p class="mb-4">No saved carousels yet.</p>
    <UButton to="/tools/carousel-creator" color="primary">
      Create your first carousel
    </UButton>
  </div>

  <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    <div v-for="carousel in carousels" :key="carousel.id"
      class="group rounded-xl border border-default bg-elevated/60 overflow-hidden hover:border-primary/50 transition-colors">
      <div class="aspect-[4/5] bg-muted relative overflow-hidden flex items-center justify-center">
        <div class="text-center p-4">
          <UIcon name="i-lucide-gallery-horizontal-end" class="size-12 text-muted-foreground mx-auto mb-2" />
          <p class="text-sm text-muted">{{ carousel.slides?.length ?? 0 }} slides</p>
        </div>
        <div class="absolute top-2 left-2 flex gap-1">
          <UBadge v-if="carousel.isPublic" color="success" variant="solid" size="xs">Public</UBadge>
        </div>
      </div>

      <div class="p-3">
        <h3 class="font-medium text-highlighted truncate">{{ carousel.name }}</h3>
        <p class="text-xs text-muted mt-1">{{ formatDate(carousel.updatedAt) }}</p>

        <div class="flex gap-2 mt-3">
          <UButton size="xs" color="primary" variant="soft" icon="i-lucide-pencil"
            @click="emit('edit', carousel)">
            Edit
          </UButton>
          <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2"
            @click="emit('delete', carousel.id)" />
        </div>
      </div>
    </div>
  </div>
</template>
