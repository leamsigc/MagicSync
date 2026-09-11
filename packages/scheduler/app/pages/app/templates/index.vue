<script lang="ts" setup>

import { parseJsonArray } from '#layers/BaseShared/utils/json';
import TemplatesCarouselList from './components/TemplatesCarouselList.vue'
import TemplatesAiList from './components/TemplatesAiList.vue'

interface SavedCarousel {
  id: string
  name: string
  slides: unknown[]
  palette: { bg: string; text: string; accent: string; font?: string }
  pattern?: string
  handle?: string
  isPublic?: boolean
  shareSlug?: string
  updatedAt?: string
}

interface AiTemplate {
  key: string
  title: string
  description: string
  createdAt: string
}

const { loggedIn, fetchSession } = UseUser()
const toast = useToast()

const carousels = ref<SavedCarousel[]>([])
const aiTemplates = ref<AiTemplate[]>([])
const isLoading = ref(true)
const activeTab = ref<'carousels' | 'templates'>('carousels')

onMounted(async () => {
  await fetchSession()
  await loadData()
})

function mapLocalToSaved(c: { id: string; name: string; slides: unknown[]; palette: { bg: string; text: string; accent: string; font?: string }; pattern?: string; handle?: string; lastModified: number }): SavedCarousel {
  return {
    id: c.id,
    name: c.name,
    slides: c.slides,
    palette: c.palette,
    pattern: c.pattern,
    handle: c.handle,
    isPublic: false,
    updatedAt: new Date(c.lastModified).toISOString(),
  }
}

function parseAiTemplates(raw: string): AiTemplate[] {
  const decks = parseJsonArray<Record<string, unknown>>(raw)
  return decks.map(d => ({
    key: d.key as string,
    title: d.title as string,
    description: d.description as string,
    createdAt: d.createdAt as string,
  }))
}

async function loadCarousels(): Promise<void> {
  if (loggedIn.value) {
    const res = await $fetch<SavedCarousel[]>('/api/v1/carousel')
    carousels.value = res ?? []
    return
  }
  const local = await getAllLocalCarousels()
  carousels.value = local.map(mapLocalToSaved)
}

function loadAiTemplates(): void {
  try {
    const raw = localStorage.getItem('carousel-ai-decks')
    if (raw) {
      aiTemplates.value = parseAiTemplates(raw)
    }
  } catch {
    aiTemplates.value = []
  }
}

async function loadData() {
  isLoading.value = true
  try {
    await loadCarousels()
    loadAiTemplates()
  } catch {
    carousels.value = []
  } finally {
    isLoading.value = false
  }
}

async function deleteCarousel(id: string) {
  if (loggedIn.value) {
    await $fetch(`/api/v1/carousel/${id}`, { method: 'DELETE' })
  } else {
    await deleteLocalCarousel(id)
  }
  carousels.value = carousels.value.filter(c => c.id !== id)
  toast.add({ title: 'Carousel deleted', color: 'success', icon: 'i-lucide-check-circle' })
}

function deleteAiTemplate(key: string) {
  try {
    const raw = localStorage.getItem('carousel-ai-decks')
    if (!raw) return
    const decks = parseJsonArray<Record<string, unknown>>(raw)
    const updated = decks.filter(d => d.key !== key)
    localStorage.setItem('carousel-ai-decks', JSON.stringify(updated))
    aiTemplates.value = aiTemplates.value.filter(t => t.key !== key)
    toast.add({ title: 'Template deleted', color: 'success', icon: 'i-lucide-check-circle' })
  } catch {
    // Ignore errors
  }
}

function openInEditor(carousel: SavedCarousel) {
  sessionStorage.setItem('repurposed-content', JSON.stringify({
    carousel,
    source: 'saved',
  }))
  navigateTo('/tools/carousel-creator')
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-highlighted">My Templates</h1>
      <p class="text-sm text-muted">Manage your saved carousels and AI-generated templates.</p>
    </div>

    <div class="flex gap-2 mb-6">
      <UButton :variant="activeTab === 'carousels' ? 'solid' : 'outline'" color="primary"
        @click="activeTab = 'carousels'">
        Saved Carousels ({{ carousels.length }})
      </UButton>
      <UButton :variant="activeTab === 'templates' ? 'solid' : 'outline'" color="primary"
        @click="activeTab = 'templates'">
        AI Templates ({{ aiTemplates.length }})
      </UButton>
    </div>

    <div v-if="isLoading" class="text-center py-24 text-muted">
      Loading...
    </div>

    <TemplatesCarouselList v-else-if="activeTab === 'carousels'" :carousels="carousels" @edit="openInEditor"
      @delete="deleteCarousel" />

    <TemplatesAiList v-else-if="activeTab === 'templates'" :templates="aiTemplates" @delete="deleteAiTemplate" />
  </div>
</template>
