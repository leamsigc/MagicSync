<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { formatColor, parseColor } from '../../../../shared/image-editor/color'

/**
 * Color field — a compact trigger (swatch + hex) that opens a popover with
 * the Nuxt UI color picker, brand presets, a hex input and an alpha slider.
 * Every studio color control (solid fill, gradient stop, stroke, shadow,
 * brush) uses this component so transparency is always available.
 */

const props = withDefaults(defineProps<{
  modelValue?: string
  /** `full` = swatch + hex label, `swatch` = square trigger only (brand kits). */
  variant?: 'full' | 'swatch'
  disabled?: boolean
  testid?: string
}>(), {
  modelValue: '#000000',
  variant: 'full',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
const open = ref(false)

const initial = parseColor(props.modelValue)
const color = ref(initial.hex)
const alpha = ref(Math.round(initial.alpha * 100))

const composed = computed(() => formatColor(color.value, alpha.value / 100))

watch(() => props.modelValue, (value) => {
  const next = parseColor(value)
  if (next.hex !== color.value) color.value = next.hex
  const nextAlpha = Math.round(next.alpha * 100)
  if (nextAlpha !== alpha.value) alpha.value = nextAlpha
})

watch([color, alpha], () => {
  const value = composed.value
  if (value !== props.modelValue) emit('update:modelValue', value)
})

const PRESETS = [
  '#111827', '#ffffff', '#ef4444', '#f97316', '#f59e0b',
  '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

function pick(value: string): void {
  color.value = parseColor(value).hex
  emit('update:modelValue', composed.value)
}

function onHexInput(value: string | number): void {
  const next = parseColor(String(value))
  color.value = next.hex
  if (String(value).includes('rgba') || String(value).includes('rgb')) alpha.value = Math.round(next.alpha * 100)
  emit('update:modelValue', composed.value)
}

function onAlphaInput(value: number | number[]): void {
  alpha.value = Array.isArray(value) ? value[0] ?? 100 : value
}
</script>

<template>
  <UPopover v-model:open="open">
    <UButton
      v-if="variant === 'swatch'"
      color="neutral" variant="outline" size="xs"
      class="p-1 h-auto w-auto rounded-md"
      :disabled="disabled"
      :aria-label="t('studio.color.pick')"
      :data-testid="testid"
      :data-color="composed">
      <span class="color-checker block size-5 rounded border border-default">
        <span class="block size-full rounded" :style="{ backgroundColor: composed }" />
      </span>
    </UButton>
    <UButton
      v-else
      color="neutral" variant="outline" size="xs"
      class="w-full justify-start gap-2 px-2 py-1.5 h-auto min-w-0"
      :disabled="disabled"
      :aria-label="t('studio.color.pick')"
      :data-testid="testid"
      :data-color="composed">
      <span class="color-checker block size-4 shrink-0 rounded border border-default">
        <span class="block size-full rounded" :style="{ backgroundColor: composed }" />
      </span>
      <span class="font-mono text-[11px] uppercase truncate">{{ composed }}</span>
      <Icon name="lucide:chevron-down" class="ml-auto size-3 shrink-0 text-muted" />
    </UButton>

    <template #content>
      <div class="w-64 space-y-3 p-3">
        <UColorPicker v-model="color" size="sm" />

        <div class="space-y-1">
          <div class="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-dimmed">
            <span>{{ t('studio.color.alpha') }}</span>
            <span class="font-mono">{{ alpha }}%</span>
          </div>
          <USlider
            :model-value="alpha"
            :min="0"
            :max="100"
            :step="1"
            size="xs"
            :aria-label="t('studio.color.alpha')"
            @update:model-value="onAlphaInput" />
        </div>

        <div class="space-y-1.5">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">{{ t('studio.color.presets') }}</div>
          <div class="grid grid-cols-10 gap-1">
            <button
              v-for="preset in PRESETS" :key="preset"
              type="button"
              class="size-5 rounded border border-default transition-transform hover:scale-110"
              :style="{ backgroundColor: preset }"
              :aria-label="preset"
              @click="pick(preset)" />
          </div>
        </div>

        <UInput
          :model-value="composed"
          size="xs"
          class="font-mono uppercase"
          :aria-label="t('studio.color.hex')"
          @update:model-value="onHexInput" />
      </div>
    </template>
  </UPopover>
</template>

<style scoped>
.color-checker {
  background-image:
    linear-gradient(45deg, #cbd5e1 25%, transparent 25%),
    linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #cbd5e1 75%),
    linear-gradient(-45deg, transparent 75%, #cbd5e1 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0;
}
</style>
