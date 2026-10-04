<i18n src="#site/app/pages/tools/og-image-generator/index.json"></i18n>

<script lang="ts" setup>
import { defaultCodeHtml, defaultCodeCss, OG_PLATFORMS, type OgPlatform } from '../../../composables/tools/og-image-generator/og-model'
import { useOgDoc } from '../../../composables/tools/og-image-generator/useOgDoc'
import OgScaledStage from './OgScaledStage.vue'
import OgDock from './OgDock.vue'

defineProps<{
  platform: OgPlatform
}>()

const { t } = useI18n()
const toast = useToast()
const doc = useOgDoc()

const activeTab = ref<'html' | 'css'>('html')
const leftDock = ref<string | null>('code')
const rightDock = ref<string | null>(null)

const leftItems = [{ key: 'code', icon: 'i-lucide-code-2', label: t('mode_code') }]
const rightItems = [
  { key: 'size', icon: 'i-lucide-proportions', label: t('size') },
  { key: 'reset', icon: 'i-lucide-rotate-ccw', label: t('reset_code') }
]

const codeTabs = [
  { label: 'HTML', value: 'html', icon: 'i-lucide-code-2' },
  { label: 'CSS', value: 'css', icon: 'i-lucide-palette' }
] as const

// Scope user CSS under the preview root so global selectors cannot leak into the app.
const scopedCss = computed(() => {
  return doc.value.codeCss.replace(/([^{}]+)\{/g, (match, selectors: string) => {
    const trimmed = selectors.trim()
    if (!trimmed || trimmed.startsWith('@')) return match
    const prefixed = trimmed
      .split(',')
      .map(s => `#og-code-root ${s.trim()}`)
      .join(', ')
    return `${prefixed} {`
  })
})

const stageStyle = computed(() => ({
  fontFamily: 'system-ui, sans-serif'
}))

const resetCode = () => {
  doc.value.codeHtml = defaultCodeHtml()
  doc.value.codeCss = defaultCodeCss()
  rightDock.value = null
  toast.add({ title: t('code_reset'), color: 'info' })
}
</script>

<template>
  <div class="relative">
    <OgScaledStage class="min-w-0" :width="platform.width" :height="platform.height">
      <div id="og-code-root" class="absolute inset-0" :style="stageStyle">
        <component :is="'style'" type="text/css">{{ scopedCss }}</component>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="contents" v-html="doc.codeHtml" />
      </div>
    </OgScaledStage>

    <OgDock v-model:active="leftDock" side="left" :items="leftItems">
      <template #code>
        <UTabs
          :model-value="activeTab"
          :items="[...codeTabs]"
          color="neutral"
          size="sm"
          @update:model-value="(v) => { activeTab = (v as 'html' | 'css') ?? 'html' }"
        />
        <UTextarea
          :model-value="activeTab === 'html' ? doc.codeHtml : doc.codeCss"
          class="w-full font-mono text-xs"
          :rows="14"
          autoresize
          :ui="{ base: 'font-mono' }"
          @update:model-value="(v: string) => { if (activeTab === 'html') doc.codeHtml = v; else doc.codeCss = v }"
        />
        <p class="text-xs text-muted">{{ t('code_mode_hint') }}</p>
      </template>
    </OgDock>

    <OgDock v-model:active="rightDock" side="right" :items="rightItems">
      <template #size>
        <p class="text-sm font-semibold">{{ t('size') }}</p>
        <div class="space-y-1">
          <button
            v-for="p in OG_PLATFORMS"
            :key="p.key"
            type="button"
            class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors"
            :class="doc.platform === p.key ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-accented/60'"
            @click="() => { doc.platform = p.key }"
          >
            <span>{{ p.label }}</span>
            <span class="text-xs text-muted">{{ p.width }}×{{ p.height }}</span>
          </button>
        </div>
      </template>
      <template #reset>
        <p class="text-sm font-semibold">{{ t('reset_code') }}</p>
        <UButton block :label="t('reset_code')" icon="i-lucide-rotate-ccw" @click="resetCode" />
      </template>
    </OgDock>
  </div>
</template>

<style scoped>
:deep(#og-code-root) {
  position: relative;
  overflow: hidden;
}
</style>
