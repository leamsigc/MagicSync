<i18n src="../index.json"></i18n>

<script lang="ts" setup>
import { useVideoCropper } from '../composables/useVideoCropper'

const { t } = useI18n()

const { subtitleStyle, subtitleText } = useVideoCropper()

const fontOptions = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Serif', value: 'Georgia' },
  { label: 'Bold', value: 'Montserrat' },
  { label: 'Playful', value: 'Poppins' },
]

const positionOptions = [
  { label: t('subtitles.bottom'), value: 'bottom' },
  { label: t('subtitles.middle'), value: 'middle' },
  { label: t('subtitles.top'), value: 'top' },
]

const colorOptions = [
  { label: t('subtitles.white'), value: '#ffffff' },
  { label: t('subtitles.yellow'), value: '#facc15' },
  { label: t('subtitles.cyan'), value: '#22d3ee' },
  { label: t('subtitles.pink'), value: '#f472b6' },
]

const predefinedStyles = [
  { key: 'modern', label: t('subtitles.style_modern'), style: { font: 'Inter', size: 36, color: '#ffffff', position: 'bottom' as const, background: true, bgColor: 'rgba(0,0,0,0.6)' } },
  { key: 'classic', label: t('subtitles.style_classic'), style: { font: 'Georgia', size: 32, color: '#ffffff', position: 'bottom' as const, background: true, bgColor: 'rgba(0,0,0,0.7)' } },
  { key: 'bold', label: t('subtitles.style_bold'), style: { font: 'Montserrat', size: 44, color: '#facc15', position: 'bottom' as const, background: true, bgColor: 'rgba(0,0,0,0.8)' } },
  { key: 'minimal', label: t('subtitles.style_minimal'), style: { font: 'Poppins', size: 28, color: '#ffffff', position: 'bottom' as const, background: false, bgColor: 'rgba(0,0,0,0.6)' } },
]

function applyPredefined(key: 'modern' | 'classic' | 'bold' | 'minimal') {
  const found = predefinedStyles.find(s => s.key === key)
  if (found) subtitleStyle.value = { ...found.style }
}
</script>

<template>
  <UCard :ui="{ body: 'p-4', root: 'w-full' }">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-message-square-text" class="w-4 h-4 text-primary" />
          <span class="font-semibold text-sm text-highlighted">{{ t('subtitles.title') }}</span>
        </div>
        <UCheckbox v-model="subtitleStyle.background" :label="t('subtitles.enable')" size="sm" />
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <UTextarea
        v-model="subtitleText"
        :placeholder="t('subtitles.text_placeholder')"
        :rows="2"
        block
        variant="subtle"
        class="text-sm"
      />

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-mono text-dimmed uppercase">{{ t('subtitles.font') }}</label>
          <USelect v-model="subtitleStyle.font" :items="fontOptions" block size="sm" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-mono text-dimmed uppercase">{{ t('subtitles.size') }}</label>
          <div class="flex items-center gap-2">
            <USlider v-model="subtitleStyle.size" :min="16" :max="72" :step="2" color="primary" class="flex-1" />
            <span class="text-xs font-mono w-8 text-right text-highlighted">{{ subtitleStyle.size }}</span>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-[10px] font-mono text-dimmed uppercase">{{ t('subtitles.position') }}</label>
        <div class="flex gap-bg-default p-1 rounded-lg border border-default">
          <UButton
            v-for="pos in positionOptions"
            :key="pos.value"
            size="xs"
            :color="subtitleStyle.position === pos.value ? 'primary' : 'neutral'"
            :variant="subtitleStyle.position === pos.value ? 'solid' : 'ghost'"
            block
            @click="subtitleStyle.position = pos.value as 'bottom' | 'middle' | 'top'"
          >
            {{ pos.label }}
          </UButton>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-[10px] font-mono text-dimmed uppercase">{{ t('subtitles.color') }}</label>
        <div class="flex gap-2">
          <UButton
            v-for="c in colorOptions"
            :key="c.value"
            :color="subtitleStyle.color === c.value ? 'primary' : 'neutral'"
            :variant="subtitleStyle.color === c.value ? 'solid' : 'ghost'"
            size="xs"
            square
            class="w-7 h-7! rounded-full!"
            @click="subtitleStyle.color = c.value"
          >
            <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: c.value }"></span>
          </UButton>
        </div>
      </div>

      <div class="pt-2 border-t border-default">
        <p class="text-[10px] font-mono text-dimmed uppercase tracking-wider mb-2">{{ t('subtitles.predefined_styles') }}</p>
        <div class="grid grid-cols-2 gap-2">
          <UButton
            v-for="ps in predefinedStyles"
            :key="ps.key"
            color="neutral"
            variant="outline"
            size="xs"
            class="font-mono"
            @click="applyPredefined(ps.key as 'modern' | 'classic' | 'bold' | 'minimal')"
          >
            {{ ps.label }}
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
