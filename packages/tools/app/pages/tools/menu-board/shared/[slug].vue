<script setup lang="ts">
/**
 *
 * Public shared menu board viewer — /tools/menu-board/shared/[slug]
 *
 * Read-only rotating display for restaurant TVs, with a prominent
 * fullscreen control. No auth required; data comes from the published
 * entity_details snapshot.
 *
 */
import BoardDisplay from '../components/BoardDisplay.vue'
import { toggleFullscreen, isFullscreenActive } from '../utils/fullscreen'
import type { MenuPage } from '../types'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

interface PublicBoard {
  name: string
  pages: MenuPage[]
  settings: { transitionTime: number }
}

const { data, error, status } = await useFetch<{ board: PublicBoard }>(`/api/v1/menu-board/public/${slug.value}`, {
  key: `menu-board-public-${slug.value}`,
})

const isFullscreen = ref(false)

function syncFullscreenState(): void {
  isFullscreen.value = isFullscreenActive()
}

async function handleToggleFullscreen(): Promise<void> {
  await toggleFullscreen()
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
  document.addEventListener('webkitfullscreenchange', syncFullscreenState)
  syncFullscreenState()
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  document.removeEventListener('webkitfullscreenchange', syncFullscreenState)
})

useHead({
  title: 'Shared Menu Board',
  meta: [{ name: 'robots', content: 'noindex' }],
})
</script>

<template>
  <div class="min-h-screen bg-black">
    <!-- Not found / error state -->
    <div v-if="error || (status === 'success' && !data?.board)"
      class="h-screen w-screen flex items-center justify-center bg-background text-foreground"
      data-testid="shared-board-missing">
      <div class="text-center p-6">
        <UIcon name="i-lucide-monitor-x" class="size-12 text-muted-foreground mx-auto mb-4" />
        <h1 class="text-2xl font-semibold mb-2">Menu not available</h1>
        <p class="text-muted-foreground">This shared menu link is invalid or no longer active.</p>
        <UButton to="/tools/menu-board" variant="outline" color="neutral" class="mt-6"
          data-testid="shared-board-cta">
          Create your own menu board
        </UButton>
      </div>
    </div>

    <template v-else-if="data?.board">
      <BoardDisplay :pages="data.board.pages" :transition-time="data.board.settings.transitionTime" />

      <!-- Prominent fullscreen control for TV displays -->
      <button v-if="!isFullscreen"
        class="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-8 py-4 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur border border-white/30 shadow-2xl transition-colors cursor-pointer text-lg font-medium"
        data-testid="fullscreen-toggle" @click="handleToggleFullscreen">
        <UIcon name="i-lucide-maximize" class="size-6" />
        View Fullscreen
      </button>

      <!-- Minimal exit control once in fullscreen (hover to reveal) -->
      <button v-else
        class="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2 rounded-full bg-white/0 hover:bg-white/20 text-white/0 hover:text-white backdrop-blur border border-white/0 hover:border-white/30 transition-all cursor-pointer opacity-20 hover:opacity-100"
        title="Exit fullscreen (Esc)" data-testid="fullscreen-exit" @click="handleToggleFullscreen">
        <UIcon name="i-lucide-minimize" class="size-5" />
        Exit Fullscreen
      </button>
    </template>
  </div>
</template>
