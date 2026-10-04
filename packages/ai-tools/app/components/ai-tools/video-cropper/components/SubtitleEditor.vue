<i18n src="#site/app/pages/app/tools/video-cropper/index.json"></i18n>

<script lang="ts" setup>
import { useVideoCropper } from '../../../../composables/ai-tools/tools/video-cropper/useVideoCropper'
import { splitText, distributeCues } from '../../../../composables/ai-tools/tools/video-cropper/subtitles'

const { t } = useI18n()

const {
  subtitleStyle, subtitleText, subtitleTimingMode, subtitleGranularity,
  subtitleWordsPerCue, subtitleSecondsPerCue, subtitleCues,
  resolvedCues, exportDuration,
} = useVideoCropper()

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

const granularityOptions = [
  { label: t('subtitles.gran_word'), value: 'word' },
  { label: t('subtitles.gran_words'), value: 'words-per-cue' },
  { label: t('subtitles.gran_line'), value: 'line' },
  { label: t('subtitles.gran_sentence'), value: 'sentence' },
]

const predefinedStyles = [
  { key: 'modern', label: t('subtitles.style_modern'), style: { font: 'Inter', size: 36, color: '#ffffff', position: 'bottom' as const, background: true, bgColor: 'rgba(0,0,0,0.6)' } },
  { key: 'classic', label: t('subtitles.style_classic'), style: { font: 'Georgia', size: 32, color: '#ffffff', position: 'bottom' as const, background: true, bgColor: 'rgba(0,0,0,0.7)' } },
  { key: 'bold', label: t('subtitles.style_bold'), style: { font: 'Montserrat', size: 44, color: '#facc15', position: 'bottom' as const, background: true, bgColor: 'rgba(0,0,0,0.8)' } },
  { key: 'minimal', label: t('subtitles.style_minimal'), style: { font: 'Poppins', size: 28, color: '#ffffff', position: 'bottom' as const, background: false, bgColor: 'rgba(0,0,0,0.6)' } },
]

const scheduleSummary = computed(() => {
  const n = resolvedCues.value.length
  if (n === 0) return ''
  const dur = exportDuration.value
  const per = subtitleSecondsPerCue.value ?? (dur > 0 ? dur / n : 0)
  return t('subtitles.schedule', { count: n, seconds: per.toFixed(2) })
})

function applyPredefined(key: 'modern' | 'classic' | 'bold' | 'minimal') {
  const found = predefinedStyles.find(s => s.key === key)
  if (found) subtitleStyle.value = { ...found.style }
}

function addCue() {
  subtitleCues.value.push({
    id: `cue-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    text: '',
    start: 0,
    end: 1,
  })
}

function removeCue(id: string) {
  subtitleCues.value = subtitleCues.value.filter(c => c.id !== id)
}

function generateCuesFromText() {
  const parts = splitText(subtitleText.value, subtitleGranularity.value, subtitleWordsPerCue.value)
  subtitleCues.value = distributeCues(parts, exportDuration.value, subtitleSecondsPerCue.value)
  subtitleTimingMode.value = 'manual'
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

      <div class="flex flex-col gap-2 bg-muted p-3 rounded-xl border border-default">
        <label class="text-[10px] font-mono text-dimmed uppercase tracking-wider">{{ t('subtitles.timing') }}</label>
        <div class="flex gap-1">
          <UButton
            size="xs"
            :variant="subtitleTimingMode === 'auto' ? 'solid' : 'ghost'"
            :color="subtitleTimingMode === 'auto' ? 'primary' : 'neutral'"
            class="flex-1"
            @click="()=>{subtitleTimingMode = 'auto'}"
          >
            {{ t('subtitles.mode_auto') }}
          </UButton>
          <UButton
            size="xs"
            :variant="subtitleTimingMode === 'manual' ? 'solid' : 'ghost'"
            :color="subtitleTimingMode === 'manual' ? 'primary' : 'neutral'"
            class="flex-1"
            @click="()=>{subtitleTimingMode = 'manual'}"
          >
            {{ t('subtitles.mode_manual') }}
          </UButton>
        </div>

        <template v-if="subtitleTimingMode === 'auto'">
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-mono text-dimmed uppercase">{{ t('subtitles.granularity') }}</label>
            <USelect v-model="subtitleGranularity" :items="granularityOptions" block size="sm" />
          </div>
          <div v-if="subtitleGranularity === 'words-per-cue'" class="flex items-center gap-2">
            <label class="text-[10px] font-mono text-dimmed uppercase flex-1">{{ t('subtitles.words_per_cue') }}</label>
            <UInput v-model.number="subtitleWordsPerCue" type="number" :min="1" :max="20" size="sm" class="w-20" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <label class="text-[10px] font-mono text-dimmed uppercase flex-1">
              {{ subtitleSecondsPerCue === null ? t('subtitles.stretch_to_fill') : t('subtitles.fixed_duration') }}
            </label>
            <div class="flex items-center gap-2">
              <UInput
                v-if="subtitleSecondsPerCue !== null"
                v-model.number="subtitleSecondsPerCue"
                type="number"
                :min="0.1"
                :step="0.1"
                size="sm"
                class="w-20"
              />
              <UButton
                size="xs"
                :icon="subtitleSecondsPerCue === null ? 'i-lucide-timer' : 'i-lucide-maximize-2'"
                variant="ghost"
                color="neutral"
                @click="()=>{subtitleSecondsPerCue = subtitleSecondsPerCue === null ? 2 : null}"
              />
            </div>
          </div>
          <p v-if="scheduleSummary" class="text-[10px] font-mono text-primary">{{ scheduleSummary }}</p>
        </template>

        <template v-else>
          <p class="text-[10px] font-mono text-dimmed">{{ t('subtitles.manual_hint') }}</p>
          <div v-if="subtitleCues.length === 0" class="text-[10px] font-mono text-dimmed text-center py-2">
            {{ t('subtitles.no_cues') }}
          </div>
          <div v-for="cue in subtitleCues" :key="cue.id" class="flex flex-col gap-1.5 bg-default p-2 rounded-lg border border-default">
            <div class="flex items-center gap-1.5">
              <UInput v-model="cue.text" :placeholder="t('subtitles.cue_text')" size="sm" block class="flex-1" />
              <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-x" @click="removeCue(cue.id)" />
            </div>
            <div class="flex items-center gap-1.5">
              <label class="text-[10px] font-mono text-dimmed">{{ t('subtitles.start') }}</label>
              <UInput v-model.number="cue.start" type="number" :min="0" step="any" size="sm" class="w-20" />
              <label class="text-[10px] font-mono text-dimmed">{{ t('subtitles.end') }}</label>
              <UInput v-model.number="cue.end" type="number" :min="0" step="any" size="sm" class="w-20" />
            </div>
          </div>
          <div class="flex gap-1.5">
            <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-plus" @click="addCue">
              {{ t('subtitles.add_cue') }}
            </UButton>
            <UButton color="primary" variant="soft" size="xs" icon="i-lucide-wand-2" @click="generateCuesFromText">
              {{ t('subtitles.generate_from_text') }}
            </UButton>
          </div>
        </template>
      </div>

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
            class="flex items-center justify-center w-7 h-7 rounded-full!"
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
