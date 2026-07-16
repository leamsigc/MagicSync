<i18n src="../index.json"></i18n>

<script lang="ts" setup>
import { useVideoCropper } from '../composables/useVideoCropper'
import { useExport } from '../composables/useExport'

export interface ExportPanelProps {
  onExport: () => void
}

const props = defineProps<ExportPanelProps>()

const { t } = useI18n()

const { settings, hasVideo } = useVideoCropper()
const { isExporting, cancelExport, exportProgress } = useExport()

const fpsOptions = [
  { label: t('export.fps_cinematic'), value: 24 },
  { label: t('export.fps_standard'), value: 30 },
  { label: t('export.fps_smooth'), value: 60 },
]

const interpolationOptions = [
  { label: t('export.motion_linear'), value: 'linear' },
  { label: t('export.motion_ease'), value: 'ease' },
  { label: t('export.motion_step'), value: 'step' },
]
</script>

<template>
  <UCard :ui="{ body: 'p-5', root: 'w-full' }">
    <template #header>
      <h4 class="font-semibold text-xs text-muted uppercase tracking-wider">{{ t('export.title') }}</h4>
    </template>

    <div class="flex flex-col gap-5">
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-highlighted">{{ t('export.framerate') }}</label>
          <USelect
            :model-value="settings.fps"
            :items="fpsOptions"
            size="sm"
            @update:model-value="(e)=>{settings.fps = e as number}"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-highlighted">{{ t('export.motion_path') }}</label>
          <USelect
            :model-value="settings.interpolation"
            :items="interpolationOptions"
            size="sm"
            @update:model-value="(e)=>{settings.interpolation = e as 'linear' | 'ease' | 'step'}"
          />
        </div>
      </div>

      <div class="flex flex-col gap-2 bg-muted p-3 rounded-xl border border-default">
        <label class="text-[10px] font-semibold text-dimmed uppercase tracking-wider">{{ t('export.export_mode') }}</label>
        <div class="flex gap-1">
          <UButton
            size="xs"
            :variant="settings.useWorker ? 'solid' : 'ghost'"
            :color="settings.useWorker ? 'primary' : 'neutral'"
            class="flex-1"
            @click="()=> {settings.useWorker = true}"
          >
            <UIcon name="i-lucide-cpu" class="w-3.5 h-3.5" />
            {{ t('export.mode_worker') }}
          </UButton>
          <UButton
            size="xs"
            :variant="!settings.useWorker ? 'solid' : 'ghost'"
            :color="!settings.useWorker ? 'primary' : 'neutral'"
            class="flex-1"
            @click="()=>{settings.useWorker = false}"
          >
            <UIcon name="i-lucide-monitor" class="w-3.5 h-3.5" />
            {{ t('export.mode_inline') }}
          </UButton>
        </div>
      </div>

      <div class="flex items-center justify-between bg-muted p-3 rounded-xl border border-default">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-volume-2" class="w-4 h-4 text-primary" />
          <span class="text-xs font-semibold text-highlighted">{{ t('export.include_audio') }}</span>
        </div>
        <UCheckbox
          :model-value="settings.includeAudio"
          @update:model-value="(e)=>{settings.includeAudio = e as boolean}"
        />
      </div>

      <div
        v-if="exportProgress.status !== 'idle'"
        class="flex flex-col gap-2 bg-muted p-4 border border-default rounded-xl"
      >
        <div class="flex justify-between items-center text-xs">
          <span
            class="font-bold font-mono"
            :class="exportProgress.status === 'completed' ? 'text-success' : exportProgress.status === 'failed' ? 'text-error' : 'text-primary'"
          >
            {{ exportProgress.statusText || (exportProgress.status === 'processing' ? t('export.processing') : exportProgress.status === 'completed' ? t('export.completed') : '') }}
          </span>
          <span v-if="exportProgress.status !== 'failed'" class="font-mono font-bold text-highlighted">{{ exportProgress.percentage }}%</span>
        </div>
        <UProgress
          :value="exportProgress.percentage"
          :max="100"
          size="sm"
          :color="exportProgress.status === 'completed' ? 'success' : exportProgress.status === 'failed' ? 'error' : 'primary'"
          :animated="exportProgress.status === 'processing'"
        />
        <div v-if="exportProgress.status === 'processing'" class="flex justify-between text-[10px] font-mono text-dimmed">
          <span>{{ t('export.progress_frame', { current: exportProgress.processedFrames, total: exportProgress.totalFrames }) }}</span>
          <span>{{ t('export.progress_time', { time: (exportProgress.elapsedTime / 1000).toFixed(1) }) }}</span>
        </div>
      </div>

      <UButton
        v-if="!isExporting"
        color="primary"
        size="lg"
        block
        :disabled="!hasVideo"
        icon="i-lucide-download"
        @click="props.onExport"
      >
        {{ t('export.export_btn') }}
      </UButton>

      <UButton
        v-else
        color="error"
        variant="outline"
        block
        @click="cancelExport"
      >
        {{ t('export.cancel_btn') }}
      </UButton>
    </div>
  </UCard>
</template>
