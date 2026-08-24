<!-- Translation file -->
<i18n src="./index.json"></i18n>

<script lang="ts" setup>
/**
 *
 * OG Image Generator Tool
 * Three switchable editors: Template (default), Code, Layers
 * PostSpark-style floating docks: left tools, right properties, bottom actions
 *
 */
import { getPlatform, GRADIENT_PRESETS } from './composables/og-model'
import { useOgDoc } from './composables/useOgDoc'
import { useOgExport } from './composables/useOgExport'
import OgTemplateEditor from './components/OgTemplateEditor.vue'
import OgCodeEditor from './components/OgCodeEditor.vue'
import OgLayeredEditor from './components/OgLayeredEditor.vue'

const { t } = useI18n()
const toast = useToast()
const { download, saveAsAsset, exporting, saving } = useOgExport()
const doc = useOgDoc()

const mode = ref<'template' | 'code' | 'layers'>('template')

const modeItems = computed(() => [
  { label: t('mode_template'), value: 'template', icon: 'i-lucide-layout-template', slot: 'template' as const },
  { label: t('mode_code'), value: 'code', icon: 'i-lucide-code-2', slot: 'code' as const },
  { label: t('mode_layers'), value: 'layers', icon: 'i-lucide-layers', slot: 'layers' as const }
])

const platform = computed(() => getPlatform(doc.value.platform))
const exportTitle = computed(() => doc.value.templateConfig.fields.title || 'og-image')

const randomize = () => {
  const g = GRADIENT_PRESETS[Math.floor(Math.random() * GRADIENT_PRESETS.length)]!
  const cfg = doc.value.templateConfig
  cfg.background.kind = 'gradient'
  cfg.background.gradientFrom = g.from
  cfg.background.gradientTo = g.to
  const templates = ['hero-left', 'hero-center', 'article', 'quote', 'event', 'promo', 'podcast', 'announcement', 'link-card', 'profile'] as const
  cfg.template = templates[Math.floor(Math.random() * templates.length)]!
  const patterns = ['none', 'grid', 'dots', 'noise'] as const
  cfg.pattern = patterns[Math.floor(Math.random() * patterns.length)]!
}

const getStageNode = (): HTMLElement | null => {
  return document.querySelector<HTMLElement>('#og-export-stage')
}

const handleDownload = () => {
  const node = getStageNode()
  if (!node) {
    toast.add({ title: t('export_failed'), color: 'error' })
    return
  }
  void download(node, platform.value, exportTitle.value)
}

const handleSaveAsset = () => {
  const node = getStageNode()
  if (!node) {
    toast.add({ title: t('save_failed'), color: 'error' })
    return
  }
  void saveAsAsset(node, platform.value, exportTitle.value)
}

useHead({
  title: t('title'),
  meta: [
    { name: 'description', content: t('description') },
    { name: 'keywords', content: 'open graph image generator, og image, social media image, twitter card generator, linkedin image generator' }
  ]
})
</script>

<template>
  <div class="min-h-screen bg-linear-to-br from-default via-muted to-default">
    <BaseHeader />
    <div class="container mx-auto px-4 pt-6 pb-32">
      <!-- Slim header -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-highlighted">{{ t('og_image_generator') }}</h1>
          <p class="text-sm text-muted">{{ t('subtitle') }}</p>
        </div>
        <UTabs
          :model-value="mode"
          :items="modeItems"
          color="neutral"
          @update:model-value="(v) => { mode = (v as typeof mode) ?? 'template' }"
        />
      </div>

      <!-- Editors -->
      <OgTemplateEditor v-if="mode === 'template'" :platform="platform" />
      <OgCodeEditor v-else-if="mode === 'code'" :platform="platform" />
      <OgLayeredEditor v-else :platform="platform" />
    </div>

    <!-- Floating bottom-center action pill -->
    <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
      <div class="flex items-center gap-1.5 rounded-2xl border border-default bg-elevated/90 backdrop-blur-md p-1.5 shadow-2xl">
        <UButton
          v-if="mode === 'template'"
          variant="ghost"
          color="neutral"
          icon="i-lucide-dices"
          :label="t('randomize')"
          class="rounded-xl"
          @click="randomize"
        />
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-download"
          :label="exporting ? t('exporting') : t('download_png')"
          :loading="exporting"
          class="rounded-xl"
          @click="handleDownload"
        />
        <UButton
          icon="i-lucide-save"
          :label="saving ? t('saving') : t('save_as_asset')"
          :loading="saving"
          class="rounded-xl"
          @click="handleSaveAsset"
        />
      </div>
    </div>
  </div>
</template>
