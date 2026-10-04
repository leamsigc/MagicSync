<i18n src="#site/app/pages/tools/menu-board/index.json"></i18n>
<script setup lang="ts">
/**
 *
 * TvPreviewModal — advanced preview: renders the board inside a TV frame
 * at the configured display resolution, scaled down to fit the device.
 * Supports changing resolution, orientation, physical TV inches, and
 * resizing all pages to fit the target TV size.
 *
 */
import { getDisplaySize, TV_DISPLAY_SIZES, type MenuPage, type TvDisplaySize } from '../../../utils/tools/menu-board/types'

const { t } = useI18n()

interface Props {
  pages: MenuPage[]
  transitionTime?: number
  displaySize: TvDisplaySize
  tvInches?: number
}

const props = withDefaults(defineProps<Props>(), {
  transitionTime: 10,
  tvInches: 55,
})

const emit = defineEmits<{
  'update:displaySize': [size: TvDisplaySize]
  'update:tvInches': [inches: number]
  'fit-pages': [size: TvDisplaySize]
}>()

const open = defineModel<boolean>('open', { default: false })

const size = computed(() => getDisplaySize(props.displaySize))
const isPortrait = computed(() => props.displaySize === 'portrait')

const TV_INCHES = [24, 32, 43, 50, 55, 65, 75, 85]

function setSize(next: TvDisplaySize): void {
  emit('update:displaySize', next)
}

function toggleOrientation(): void {
  setSize(isPortrait.value ? 'fhd' : 'portrait')
}

const diagonalPx = computed(() =>
  Math.sqrt(size.value.width ** 2 + size.value.height ** 2),
)
const ppi = computed(() =>
  Math.round(diagonalPx.value / Math.max(props.tvInches, 1)),
)

const currentIndex = ref(0)
let rotateTimer: ReturnType<typeof setInterval> | null = null

watch(() => props.pages.length, (len) => {
  if (currentIndex.value >= len) currentIndex.value = 0
})

function stopRotation(): void {
  if (rotateTimer) clearInterval(rotateTimer)
  rotateTimer = null
}

function startRotation(): void {
  stopRotation()
  if (props.pages.length <= 1) return
  rotateTimer = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % props.pages.length
  }, Math.max(1, props.transitionTime) * 1000)
}

watch(() => [props.pages.length, props.transitionTime], () => startRotation())
watch(open, (isOpen) => {
  if (isOpen) startRotation()
  else stopRotation()
})

onMounted(startRotation)
onBeforeUnmount(stopRotation)

const currentPage = computed(() => props.pages[currentIndex.value])

// Scale stage to fit available modal space
const maxStageWidth = 900
const maxStageHeight = 620
const scale = computed(() =>
  Math.min(maxStageWidth / size.value.width, maxStageHeight / size.value.height, 0.6),
)
const scaledWidth = computed(() => Math.round(size.value.width * scale.value))
const scaledHeight = computed(() => Math.round(size.value.height * scale.value))

// TV bezel padding shrinks slightly for larger TVs
const bezelPad = computed(() => Math.max(6, Math.round(14 - props.tvInches / 12)))
</script>

<template>
  <UModal v-model:open="open" fullscreen>
    <template #content>
      <div class="p-6 space-y-4 h-full flex flex-col" data-testid="tv-preview-modal">
        <div class="flex justify-between items-start gap-4">
          <div>
            <h2 class="text-xl font-semibold tracking-tight">TV Preview</h2>
            <p class="text-sm text-muted-foreground">
              {{ size.label }} · {{ tvInches }}" — {{ t('tv_preview_desc', { ppi }) }}
            </p>
          </div>
          <UButton variant="ghost" color="neutral" icon="i-lucide-x" @click="() => { open = false }" />
        </div>

        <!-- Controls -->
        <div class="flex flex-wrap items-end gap-3 justify-center" data-testid="tv-preview-controls">
          <UFormField :label="t('tv_size')" size="xs">
            <USelect
              :model-value="displaySize"
              :items="TV_DISPLAY_SIZES.map(s => ({ label: s.label, value: s.key }))"
              class="w-52" data-testid="tv-preview-size"
              @update:model-value="v => setSize(String(v) as TvDisplaySize)" />
          </UFormField>

          <UFormField :label="t('tv_inches')" size="xs">
            <USelect
              :model-value="String(tvInches)"
              :items="TV_INCHES.map(i => ({ label: t('inch', { n: i }), value: String(i) }))"
              class="w-28" data-testid="tv-preview-inches"
              @update:model-value="v => emit('update:tvInches', Number(v))" />
          </UFormField>

          <UButton
            :icon="isPortrait ? 'i-lucide-smartphone' : 'i-lucide-monitor'"
            variant="outline" color="neutral" data-testid="tv-preview-orientation"
            @click="toggleOrientation">
            {{ isPortrait ? t('vertical') : t('horizontal') }}
          </UButton>

          <UTooltip :text="t('resize_all_hint')">
            <UButton
              icon="i-lucide-scaling" variant="outline" color="neutral"
              data-testid="tv-preview-fit-pages"
              @click="emit('fit-pages', displaySize)">
              {{ t('resize_all_pages') }}
            </UButton>
          </UTooltip>
        </div>

        <!-- TV frame -->
        <div class="flex justify-center flex-1 min-h-0 items-center py-2">
          <div
            class="rounded-2xl bg-neutral-950 shadow-2xl ring-1 ring-neutral-700/60 border border-neutral-800"
            :style="{ padding: `${bezelPad}px` }">
            <div class="relative overflow-hidden rounded-lg bg-black"
              :style="{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }" data-testid="tv-preview-screen">
              <div class="absolute top-0 left-0 origin-top-left"
                :style="{ transform: `scale(${scale})`, width: `${size.width}px`, height: `${size.height}px` }">
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div v-if="currentPage && currentPage.type === 'html'" class="w-full h-full"
                  v-html="currentPage.content" />
                <img v-else-if="currentPage" :src="currentPage.content" :alt="currentPage.name"
                  class="w-full h-full object-contain">
                <div v-else class="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                  {{ t('no_active_pages') }}
                </div>
              </div>
            </div>
            <!-- TV stand -->
            <div class="mx-auto mt-1 flex justify-center">
              <div class="h-2 rounded-b-lg bg-neutral-800"
                :style="{ width: `${Math.round(scaledWidth * 0.25)}px` }" />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-center gap-2 flex-wrap pb-4" data-testid="tv-preview-page-selector">
          <UButton v-for="(page, i) in pages" :key="page.id" size="xs"
            :variant="i === currentIndex ? 'solid' : 'outline'" color="neutral" @click="() => { currentIndex = i }">
            {{ page.name }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
