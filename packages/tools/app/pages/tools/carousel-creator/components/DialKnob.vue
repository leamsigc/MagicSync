<script lang="ts" setup>
const props = withDefaults(defineProps<{
  label: string
  modelValue: number
  min: number
  max: number
  step?: number
  unit?: string
  defaultValue?: number
}>(), {
  step: 1,
  unit: '',
  defaultValue: 0,
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const el = ref<HTMLElement | null>(null)

function clamp(value: number): number {
  const rounded = Math.round(value / props.step) * props.step
  return Math.min(props.max, Math.max(props.min, rounded))
}

function set(value: number): void {
  emit('update:modelValue', clamp(value))
}

function reset(): void {
  set(props.defaultValue)
}

let startY = 0
let startValue = 0

function onPointerDown(event: PointerEvent): void {
  event.preventDefault()
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  startY = event.clientY
  startValue = props.modelValue
}

function onPointerMove(event: PointerEvent): void {
  if (!(event.target as HTMLElement).hasPointerCapture(event.pointerId)) return
  const range = props.max - props.min
  const pixelsPerRange = 150
  set(startValue + ((startY - event.clientY) / pixelsPerRange) * range)
}

function onPointerUp(event: PointerEvent): void {
  ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
    event.preventDefault()
    set(props.modelValue + props.step)
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
    event.preventDefault()
    set(props.modelValue - props.step)
  }
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  set(props.modelValue + (event.deltaY < 0 ? props.step : -props.step))
}

const rotation = computed(() => {
  const range = props.max - props.min
  const percent = range === 0 ? 0 : (props.modelValue - props.min) / range
  return -135 + percent * 270
})

const display = computed(() => `${Math.round(props.modelValue)}${props.unit}`)
</script>

<template>
  <div class="flex flex-col items-center gap-1 select-none">
    <div
      ref="el"
      role="slider"
      tabindex="0"
      :aria-label="label"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="modelValue"
      :data-testid="`dial-${label.toLowerCase().replace(/\s+/g, '-')}`"
      class="relative h-12 w-12 rounded-full border border-default bg-muted cursor-ns-resize outline-none focus-visible:ring-2 ring-primary touch-none"
      title="Drag or scroll · double-click to reset"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="reset"
      @keydown="onKeydown"
      @wheel="onWheel"
    >
      <span
        class="absolute left-1/2 top-1/2 h-[22px] w-[2px] bg-neutral-500 origin-bottom"
        :style="{ transform: `translateX(-50%) translateY(-100%) rotate(${rotation}deg)`, transformOrigin: '50% 100%' }"
      />
      <span
        v-for="tick in 11"
        :key="tick"
        class="absolute left-1/2 top-1/2 h-[3px] w-px bg-neutral-600"
        :style="{ transform: `translateX(-50%) rotate(${-135 + (tick - 1) * 27}deg) translateY(-21px)` }"
      />
      <span class="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-toned pointer-events-none">
        {{ display }}
      </span>
    </div>
    <span class="text-[9px] uppercase tracking-wider text-muted">{{ label }}</span>
  </div>
</template>
