<script lang="ts" setup>
interface AiTemplate {
  key: string
  title: string
  description: string
  createdAt: string
}

defineProps<{
  templates: AiTemplate[]
}>()

const emit = defineEmits<{
  delete: [key: string]
}>()

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div v-if="templates.length === 0" class="text-center py-24 text-muted">
    <p class="mb-4">No AI templates yet.</p>
    <UButton to="/tools/carousel-creator" color="primary">
      Generate your first template
    </UButton>
  </div>

  <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    <div v-for="template in templates" :key="template.key"
      class="rounded-xl border border-default bg-elevated/60 p-4">
      <h3 class="font-medium text-highlighted">{{ template.title }}</h3>
      <p class="text-xs text-muted mt-1 line-clamp-2">{{ template.description }}</p>
      <p class="text-xs text-muted mt-2">{{ formatDate(template.createdAt) }}</p>

      <div class="flex gap-2 mt-3">
        <UButton size="xs" color="primary" variant="soft" icon="i-lucide-sparkles" to="/tools/carousel-creator">
          Use
        </UButton>
        <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2"
          @click="emit('delete', template.key)" />
      </div>
    </div>
  </div>
</template>
