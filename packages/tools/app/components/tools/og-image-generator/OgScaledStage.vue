<script lang="ts" setup>
const props = defineProps<{
  width: number
  height: number
}>()

const wrap = ref<HTMLElement | null>(null)
const scale = ref(1)

let observer: ResizeObserver | null = null

const computeScale = () => {
  if (!wrap.value) return
  const availableWidth = wrap.value.parentElement?.clientWidth ?? wrap.value.clientWidth
  const availableHeight = Math.max(window.innerHeight - 320, 300)
  scale.value = Math.min(availableWidth / props.width, availableHeight / props.height, 1)
}

const scaledWidth = computed(() => Math.max(Math.round(props.width * scale.value), 1))
const scaledHeight = computed(() => Math.max(Math.round(props.height * scale.value), 1))

onMounted(() => {
  observer = new ResizeObserver(computeScale)
  if (wrap.value?.parentElement) observer.observe(wrap.value.parentElement)
  computeScale()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watch(() => [props.width, props.height], () => nextTick(computeScale))

defineExpose({ scale })
</script>

<template>
  <div class="w-full flex justify-center">
    <div
      ref="wrap"
      class="relative"
      :style="{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }"
    >
      <div
        class="absolute top-0 left-0 origin-top-left"
        :style="{ transform: `scale(${scale})`, width: `${width}px`, height: `${height}px` }"
      >
        <div
          id="og-export-stage"
          class="relative w-full h-full overflow-hidden shadow-2xl rounded-lg ring-1 ring-neutral-700/60"
        >
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
