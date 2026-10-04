<i18n src="#site/app/pages/tools/menu-board/index.json"></i18n>
<script setup lang="ts">
/**
 *
 * BoardDisplay — full-screen rotating menu board renderer.
 * Used by the admin preview (with lock/unlock) and the public shared page.
 *
 */
import type { MenuPage } from '../../../utils/tools/menu-board/types'

const { t } = useI18n()

interface Props {
  pages: MenuPage[]
  transitionTime?: number
  isLocked?: boolean
  /** Admin mode: enables hidden exit corner + PIN unlock */
  interactive?: boolean
  /** Returns true when the pin unlocks the display */
  validatePin?: (pin: string) => boolean
  /** Target TV resolution — when set, content renders in a fixed-size stage scaled to fit the real screen */
  displayWidth?: number
  displayHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  transitionTime: 10,
  isLocked: false,
  interactive: false,
  validatePin: undefined,
  displayWidth: 0,
  displayHeight: 0,
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

const FALLBACK_IMAGE = 'https://picsum.photos/seed/fallback/600/400'

// ---------- target-resolution scaling ----------
const viewport = ref({ w: 1920, h: 1080 })

function updateViewport(): void {
  if (import.meta.client) viewport.value = { w: window.innerWidth, h: window.innerHeight }
}

const hasFixedStage = computed(() => props.displayWidth > 0 && props.displayHeight > 0)
const stageScale = computed(() =>
  hasFixedStage.value ? Math.min(viewport.value.w / props.displayWidth, viewport.value.h / props.displayHeight) : 1,
)

onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
})
</script>

<template>
  <div class="h-screen w-screen overflow-hidden bg-black relative flex items-center justify-center"
    data-testid="display-board">
    <!-- Content renders at the target TV resolution and scales to fit the actual screen -->
    <div class="relative shrink-0 origin-center overflow-hidden bg-black" :style="hasFixedStage
      ? { width: `${displayWidth}px`, height: `${displayHeight}px`, transform: `scale(${stageScale})` }
      : { width: '100%', height: '100%' }" @click="handleHiddenClick">
      <div v-if="safePages.length === 0" class="h-full w-full flex items-center justify-center text-white"
        data-testid="display-empty">
        <div class="text-center">
          <h1 class="text-4xl font-bold mb-4">{{ t('no_active_pages') }}</h1>
          <p class="text-gray-400">{{ t('no_pages_hint') }}</p>
          <button v-if="interactive && !isLocked" data-testid="display-exit"
            class="mt-8 px-6 py-2 bg-white text-black rounded-full font-medium" @click.stop="handleHiddenClick">
            {{ t('create_own_cta') }}
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
    </div>

    <!-- Hidden exit / unlock area — top right corner -->
    <div class="absolute top-0 right-0 w-32 h-32 z-50 cursor-default" data-testid="display-hidden-corner"
      :title="isLocked ? 'Click 5 times to unlock' : 'Click to exit'" @click="handleHiddenClick" />

    <!-- Unlock prompt -->
    <div v-if="showUnlockPrompt"
      class="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div class="bg-background text-foreground p-8 rounded-2xl shadow-2xl max-w-sm w-full ">
        <div class="flex justify-center mb-4">
          <div class="w-16 h-16 bg-accent text-accent-foreground rounded-full flex items-center justify-center">
            <UIcon name="i-lucide-lock" class="size-8" />
          </div>
        </div>
        <h2 class="text-2xl font-bold text-center mb-6">{{ t('unlock_display') }}</h2>
        <form @submit.prevent="submitPin">
          <UInput v-model="pinInput" type="password" size="xl" :placeholder="t('unlock_pin')"
            :color="pinError ? 'error' : 'primary'" class="w-full mb-4" data-testid="unlock-pin-input" />
          <p v-if="pinError" class="text-destructive text-center text-sm mb-4" data-testid="unlock-pin-error">
            {{ t('incorrect_pin') }}
          </p>
          <div class="flex gap-3">
            <UButton variant="outline" color="neutral" block @click="() => { showUnlockPrompt = false }">
              {{ t('cancel') }}
            </UButton>
            <UButton type="submit" block data-testid="unlock-submit">
              {{ t('view_fullscreen') }}
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
