<script setup lang="ts">
/**
 *
 * BoardDisplay — full-screen rotating menu board renderer.
 * Used by the admin preview (with lock/unlock) and the public shared page.
 *
 */
import type { MenuPage } from '../types'

interface Props {
  pages: MenuPage[]
  transitionTime?: number
  isLocked?: boolean
  /** Admin mode: enables hidden exit corner + PIN unlock */
  interactive?: boolean
  /** Returns true when the pin unlocks the display */
  validatePin?: (pin: string) => boolean
}

const props = withDefaults(defineProps<Props>(), {
  transitionTime: 10,
  isLocked: false,
  interactive: false,
  validatePin: undefined,
})

const emit = defineEmits<{
  exit: []
}>()

const currentIndex = ref(0)
const showUnlockPrompt = ref(false)
const pinInput = ref('')
const pinError = ref(false)
let clickCount = 0
let clickTimer: ReturnType<typeof setTimeout> | null = null
let rotateTimer: ReturnType<typeof setInterval> | null = null

const safePages = computed(() => props.pages.filter(p => p.type === 'html' || p.type === 'image'))
const currentPage = computed(() => safePages.value[currentIndex.value])

watch(() => safePages.value.length, (len) => {
  if (currentIndex.value >= len) currentIndex.value = 0
})

watch([() => props.transitionTime, () => safePages.value.length], () => {
  if (rotateTimer) clearInterval(rotateTimer)
  if (safePages.value.length <= 1) return
  rotateTimer = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % safePages.value.length
  }, Math.max(1, props.transitionTime) * 1000)
})

onMounted(() => {
  if (safePages.value.length <= 1) return
  rotateTimer = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % safePages.value.length
  }, Math.max(1, props.transitionTime) * 1000)
})

onBeforeUnmount(() => {
  if (rotateTimer) clearInterval(rotateTimer)
})

function handleHiddenClick(): void {
  if (!props.interactive) return
  if (!props.isLocked) {
    emit('exit')
    return
  }
  clickCount += 1
  if (clickTimer) clearTimeout(clickTimer)
  clickTimer = setTimeout(() => { clickCount = 0 }, 2000)
  if (clickCount >= 5) {
    showUnlockPrompt.value = true
    clickCount = 0
  }
}

function submitPin(): void {
  if (props.validatePin?.(pinInput.value)) {
    showUnlockPrompt.value = false
    pinInput.value = ''
    pinError.value = false
  } else {
    pinError.value = true
    setTimeout(() => { pinError.value = false }, 2000)
    pinInput.value = ''
  }
}

const FALLBACK_IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 800 600"><rect fill="%23333" width="800" height="600"/><text fill="%23888" font-family="sans-serif" font-size="24" x="50%" y="50%" text-anchor="middle">Image Failed to Load</text></svg>'
</script>

<template>
  <div class="h-screen w-screen overflow-hidden bg-black relative" data-testid="display-board">
    <div
v-if="safePages.length === 0"
      class="h-full w-full flex items-center justify-center text-white" data-testid="display-empty"
      @click="handleHiddenClick">
      <div class="text-center">
        <h1 class="text-4xl font-bold mb-4">No Active Pages</h1>
        <p class="text-gray-400">Add and activate pages in the admin panel.</p>
        <button
v-if="interactive && !isLocked" data-testid="display-exit"
          class="mt-8 px-6 py-2 bg-white text-black rounded-full font-medium"
          @click.stop="handleHiddenClick">
          Return to Admin
        </button>
      </div>
    </div>

    <Transition v-else name="menu-fade" mode="out-in">
      <div :key="currentPage?.id ?? currentIndex"
        class="absolute inset-0 w-full h-full flex items-center justify-center">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="currentPage?.type === 'html'" class="w-full h-full" data-testid="display-html-page"
          v-html="currentPage?.content" />
        <img v-else-if="currentPage" :src="currentPage.content" :alt="currentPage.name"
          class="w-full h-full object-contain" data-testid="display-image-page"
          @error="($event.target as HTMLImageElement).src = FALLBACK_IMAGE">
      </div>
    </Transition>

    <!-- Hidden exit / unlock area — top right corner -->
    <div
class="absolute top-0 right-0 w-32 h-32 z-50 cursor-default" data-testid="display-hidden-corner"
      :title="isLocked ? 'Click 5 times to unlock' : 'Click to exit'" @click="handleHiddenClick" />

    <!-- Unlock prompt -->
    <div
v-if="showUnlockPrompt"
      class="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div class="bg-background text-foreground p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-border">
        <div class="flex justify-center mb-4">
          <div class="w-16 h-16 bg-accent text-accent-foreground rounded-full flex items-center justify-center">
            <UIcon name="i-lucide-lock" class="size-8" />
          </div>
        </div>
        <h2 class="text-2xl font-bold text-center mb-6">Unlock Display</h2>
        <form @submit.prevent="submitPin">
          <UInput
v-model="pinInput" type="password" size="xl" placeholder="••••"
            :color="pinError ? 'error' : 'primary'" class="w-full mb-4" data-testid="unlock-pin-input" />
          <p v-if="pinError" class="text-destructive text-center text-sm mb-4" data-testid="unlock-pin-error">
            Incorrect PIN
          </p>
          <div class="flex gap-3">
            <UButton variant="outline" color="neutral" block @click="() => { showUnlockPrompt = false }">
              Cancel
            </UButton>
            <UButton type="submit" block data-testid="unlock-submit">
              Unlock
            </UButton>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.8s ease;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
}
</style>
