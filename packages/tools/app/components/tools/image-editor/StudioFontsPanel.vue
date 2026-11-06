<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs'
import { FONT_MANIFEST, FONT_PAIRS } from '../../../../shared/image-editor/fonts-manifest'
import {
  googleFontFamilies,
  googleCategoryKey,
  loadGoogleFont,
  type GoogleFontFamily,
} from '../../../../shared/image-editor/google-fonts'
import { ensureBrowserFonts } from '../../../../shared/image-editor/browser-fonts'

/**
 * Fonts panel — the full Google Fonts catalog (~1,900 families) loaded on
 * demand, plus the bundled local families. Font pairs insert a heading and a
 * body text layer using each font.
 */

const { t } = useI18n()
const { editor } = useFabricJs()

const query = ref('')
const category = ref<'all' | 'local' | 'sans' | 'serif' | 'display' | 'handwriting' | 'mono'>('all')
const families = ref<GoogleFontFamily[]>([])
const visibleCount = ref(120)
const loading = ref(false)
const loadingFamily = ref<string | null>(null)
const applyingPair = ref<number | null>(null)

const CATEGORIES = ['all', 'local', 'sans', 'serif', 'display', 'handwriting', 'mono'] as const
const CATEGORY_KEYS: Record<string, string> = {
  all: 'studio.fonts.cat.all',
  local: 'studio.fonts.cat.local',
  sans: 'studio.fonts.cat.sans',
  serif: 'studio.fonts.cat.serif',
  display: 'studio.fonts.cat.display',
  handwriting: 'studio.fonts.cat.handwriting',
  mono: 'studio.fonts.cat.mono',
}

const localFamilies = FONT_MANIFEST.map(entry => ({ family: entry.family, category: 'Local' }))

/** System families need no Google stylesheet. */
const SYSTEM_FONTS = new Set(['Arial', 'Helvetica', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia'])

const source = computed<GoogleFontFamily[]>(() => {
  if (category.value === 'local') return localFamilies
  const google = families.value
  const combined = query.value.trim() === '' && category.value === 'all'
    ? [...localFamilies, ...google]
    : google.length > 0 ? google : localFamilies
  return combined
})

const filtered = computed(() => {
  const term = query.value.trim().toLowerCase()
  const categoryFilter = category.value
  return source.value.filter((entry) => {
    if (term && !entry.family.toLowerCase().includes(term)) return false
    if (categoryFilter === 'all' || categoryFilter === 'local') return true
    return googleCategoryKey(entry.category) === categoryFilter
  })
})

const visible = computed(() => filtered.value.slice(0, visibleCount.value))
const hasMore = computed(() => filtered.value.length > visibleCount.value)

function setCategory(next: typeof CATEGORIES[number]): void {
  category.value = next
  visibleCount.value = 120
}

async function applyFont(family: string): Promise<void> {
  loadingFamily.value = family
  await Promise.all([ensureBrowserFonts([family]), loadGoogleFont(family)])
  const canvas = editor.value?.fabricCanvas
  if (!canvas) {
    loadingFamily.value = null
    return
  }
  const active = canvas.getActiveObject() as unknown as { type?: string; set: (key: string, value: string) => void } | undefined
  const targets = active && ['textbox', 'i-text', 'text'].includes(active.type ?? '') ? [active] : []
  const fallback = targets.length === 0
    ? canvas.getObjects().filter(obj => ['textbox', 'i-text', 'text'].includes((obj as { type?: string }).type ?? '')) as unknown as Array<{ set: (key: string, value: string) => void }>
    : targets
  const applied = targets.length > 0 ? targets : fallback
  if (applied.length === 0) {
    addTextLayer(t('studio.fonts.sample'), family, 64, 240)
    loadingFamily.value = null
    useToast().add({ title: t('studio.fonts.addedLayer', { family }), color: 'success', icon: 'i-lucide-type' })
    return
  }
  for (const target of applied) target.set('fontFamily', family)
  canvas.requestRenderAll()
  loadingFamily.value = null
  useToast().add({ title: t('studio.fonts.applied', { count: applied.length }), color: 'success', icon: 'i-lucide-check' })
}

/** Insert a text layer and force the requested family on it. */
function addTextLayer(text: string, family: string, fontSize: number, top: number): void {
  editor.value?.addTextLayer?.(text, { fontSize, fontWeight: 'bold' })
  const active = editor.value?.fabricCanvas?.getActiveObject() as unknown as { set?: (values: Record<string, unknown>) => void } | undefined
  active?.set?.({ fontFamily: family, left: 90, top })
  editor.value?.fabricCanvas?.requestRenderAll()
}

async function applyPair(pair: { heading: string; body: string }): Promise<void> {
  applyingPair.value = 1
  const families = [pair.heading, pair.body]
  // System bodies (Arial) must not trigger a Google Fonts request at all.
  const googleFamilies = families.filter(family => !SYSTEM_FONTS.has(family))
  await Promise.all([
    ensureBrowserFonts(families),
    ...googleFamilies.map(family => loadGoogleFont(family)),
  ])
  addTextLayer(t('studio.fonts.pairHeading'), pair.heading, 72, 220)
  addTextLayer(t('studio.fonts.pairBody'), pair.body, 32, 360)
  applyingPair.value = null
  useToast().add({ title: t('studio.fonts.pairAdded'), description: `${pair.heading} + ${pair.body}`, color: 'success', icon: 'i-lucide-type' })
}

onMounted(async () => {
  loading.value = true
  families.value = await googleFontFamilies()
  loading.value = false
})
</script>

<template>
  <div class="space-y-4">
    <section class="space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-[11px] font-semibold uppercase tracking-wider text-dimmed">{{ t('studio.fonts.pairs') }}</h3>
        <span class="text-[10px] text-muted">{{ t('studio.fonts.pairsHint') }}</span>
      </div>
      <div class="space-y-2">
        <button
          v-for="(pair, index) in FONT_PAIRS" :key="index"
          type="button"
          class="w-full rounded-xl border border-default bg-elevated/50 p-3 text-left transition-colors hover:border-primary"
          :disabled="applyingPair !== null"
          @click="applyPair(pair)">
          <div class="text-2xl leading-tight" :style="{ fontFamily: `'${pair.heading}', sans-serif` }">
            {{ t('studio.fonts.pairHeading') }}
          </div>
          <div class="mt-1 text-sm text-muted" :style="{ fontFamily: `'${pair.body}', sans-serif` }">
            {{ t('studio.fonts.pairBody') }}
          </div>
          <div class="mt-2 text-[10px] font-medium text-dimmed">{{ pair.heading }} · {{ pair.body }}</div>
        </button>
      </div>
    </section>

    <section class="space-y-2">
      <div class="flex gap-1.5 flex-wrap">
        <UButton
          v-for="cat in CATEGORIES" :key="cat" size="xs"
          :variant="category === cat ? 'soft' : 'ghost'"
          :color="category === cat ? 'primary' : 'neutral'"
          @click="setCategory(cat)">
          {{ t(CATEGORY_KEYS[cat] ?? cat) }}
        </UButton>
      </div>

      <UInput v-model="query" size="sm" icon="lucide:search" :placeholder="t('studio.fonts.search')" />

      <div v-if="loading" class="flex items-center gap-2 py-3 text-xs text-muted">
        <Icon name="svg-spinners:270-ring-with-bg" class="size-4" />
        {{ t('studio.fonts.loadingCatalog') }}
      </div>

      <div class="space-y-1">
        <button
          v-for="font in visible" :key="font.family"
          type="button"
          class="flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-default hover:bg-elevated"
          :style="{ fontFamily: `'${font.family}', sans-serif` }"
          @click="applyFont(font.family)">
          <span class="truncate text-base">{{ font.family }}</span>
          <Icon
            v-if="loadingFamily === font.family"
            name="svg-spinners:270-ring-with-bg" class="size-4 shrink-0 text-muted" />
        </button>
      </div>

      <UButton
        v-if="hasMore"
        block size="xs" variant="outline"
        @click="visibleCount += 120">
        {{ t('studio.fonts.loadMore', { count: filtered.length - visibleCount }) }}
      </UButton>

      <div v-if="!loading && filtered.length === 0" class="py-6 text-center text-xs text-muted">
        {{ t('studio.fonts.noResults') }}
      </div>
    </section>
  </div>
</template>
