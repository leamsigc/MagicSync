<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs'
import { RESIZE_CATALOG } from '../../../composables/tools/image-editor/editor/plugins/ResizePlugin'

/**
 * Resize tab — catalog-driven frame changes (scale / reflow / pad).
 */

interface CatalogEntry {
  id: string
  label: string
  width: number
  height: number
  group: string
}

const props = { catalog: RESIZE_CATALOG as CatalogEntry[] }
void props

const { t } = useI18n()
const { editor } = useFabricJs()

const customWidth = ref(1080)
const customHeight = ref(1080)
const mode = ref<'scale' | 'reflow' | 'pad'>('scale')
const applied = ref<string | null>(null)

const groups = computed(() => [...new Set(props.catalog.map(entry => entry.group))])

const GROUP_KEYS: Record<string, string> = {
  social: 'studio.resize.g.social',
  print: 'studio.resize.g.print',
  web: 'studio.resize.g.web',
  video: 'studio.resize.g.video',
}

const MODE_OPTIONS = [
  { label: t('studio.resize.mode.scale'), value: 'scale' },
  { label: t('studio.resize.mode.pad'), value: 'pad' },
  { label: t('studio.resize.mode.reflow'), value: 'reflow' },
]

function plugin(): unknown {
  return editor.value?.getPlugin?.('resize')
}

function applyCustom(): void {
  const studioPlugin = plugin() as { resizeFrame?: (w: number, h: number, mode: 'scale' | 'reflow' | 'pad') => void } | undefined
  if (!studioPlugin?.resizeFrame) return
  studioPlugin.resizeFrame(customWidth.value, customHeight.value, mode.value)
  applied.value = `${customWidth.value}×${customHeight.value}`
}

function applyEntry(entry: CatalogEntry): void {
  const studioPlugin = plugin() as { resizeFrame?: (w: number, h: number, mode: 'scale' | 'reflow' | 'pad') => void } | undefined
  if (!studioPlugin?.resizeFrame) return
  customWidth.value = entry.width
  customHeight.value = entry.height
  studioPlugin.resizeFrame(entry.width, entry.height, mode.value)
  applied.value = entry.label
  useToast().add({
    title: t('studio.resize.appliedTitle', { name: entry.label }),
    description: `${entry.width}×${entry.height}`,
    color: 'success',
    icon: 'i-lucide-ruler',
  })
}

function fitToFrame(): void {
  const studioPlugin = plugin() as { fitObjectsToFrame?: () => void } | undefined
  studioPlugin?.fitObjectsToFrame?.()
}

function centerAll(): void {
  const studioPlugin = plugin() as { centerAll?: () => void } | undefined
  studioPlugin?.centerAll?.()
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-xl border border-default bg-elevated/50 p-3 space-y-3">
      <UFormField :label="t('studio.resize.modeLabel')" size="xs">
        <USelect v-model="mode" :items="MODE_OPTIONS" size="xs" />
      </UFormField>
      <div class="flex gap-2 items-end">
        <UFormField :label="t('studio.resize.width')" size="xs" class="flex-1">
          <UInput v-model.number="customWidth" type="number" size="xs" :min="10" :max="8192" />
        </UFormField>
        <span class="text-muted text-xs pb-1.5">×</span>
        <UFormField :label="t('studio.resize.height')" size="xs" class="flex-1">
          <UInput v-model.number="customHeight" type="number" size="xs" :min="10" :max="8192" />
        </UFormField>
        <UButton size="xs" color="primary" variant="soft" icon="lucide:ruler" @click="applyCustom">
          {{ t('studio.resize.apply') }}
        </UButton>
      </div>
      <div class="flex gap-2">
        <UButton size="xs" variant="ghost" icon="lucide:maximize-2" @click="fitToFrame">{{ t('studio.resize.fit') }}</UButton>
        <UButton size="xs" variant="ghost" icon="lucide:align-center" @click="centerAll">{{ t('studio.resize.center') }}</UButton>
      </div>
      <div v-if="applied" class="text-[11px] text-muted">{{ t('studio.resize.applied', { size: applied }) }}</div>
    </div>

    <section v-for="group in groups" :key="group" class="space-y-2">
      <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">{{ t(GROUP_KEYS[group] ?? group) }}</h3>
      <div class="grid grid-cols-2 gap-1.5">
        <button
          v-for="entry in props.catalog.filter(item => item.group === group)" :key="entry.id"
          type="button"
          class="text-left rounded-lg border border-default bg-elevated/50 px-2.5 py-2 hover:border-primary transition-colors"
          data-testid="resize-entry"
          @click="applyEntry(entry)">
          <div class="text-xs font-medium truncate">{{ entry.label }}</div>
          <div class="text-[10px] text-muted font-mono">{{ entry.width }}×{{ entry.height }}</div>
        </button>
      </div>
    </section>
  </div>
</template>
