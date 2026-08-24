<script lang="ts" setup>
const props = defineProps<{
  html: string
  width?: number
  height?: number
  guides?: boolean
  fxStyle?: string
}>()

const stageWidth = props.width ?? 1080
const stageHeight = props.height ?? 1350
const ratio = stageWidth / stageHeight

const wrap = ref<HTMLElement | null>(null)
const scale = ref(0)

let observer: ResizeObserver | null = null

function computeScale(): void {
  if (!wrap.value) return
  scale.value = Math.min(wrap.value.clientWidth / stageWidth, 1)
}

onMounted(() => {
  observer = new ResizeObserver(computeScale)
  if (wrap.value) observer.observe(wrap.value)
  computeScale()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div class="w-full flex justify-center">
    <div
      ref="wrap"
      class="relative"
      :style="{ width: `min(100%, calc((100vh - 280px) * ${ratio}))`, aspectRatio: `${stageWidth} / ${stageHeight}` }"
    >
      <div
        class="absolute top-0 left-0 origin-top-left"
        :style="{ transform: `scale(${scale})`, width: `${stageWidth}px`, height: `${stageHeight}px`, '--slide-fx': props.fxStyle || 'none' }"
      >
        <div
          id="carousel-stage"
          class="relative w-full h-full overflow-hidden shadow-2xl rounded-lg ring-1 ring-neutral-700/60 select-none"
          v-html="html"
        />

        <div
          v-if="props.guides"
          data-testid="stage-guides"
          class="absolute inset-0 pointer-events-none"
        >
          <div class="absolute inset-0 grid grid-cols-3 grid-rows-3">
            <span v-for="i in 9" :key="i" class="border border-primary-400/30" />
          </div>
          <div class="absolute border-2 border-dashed border-primary-400/50" style="left:80px;right:80px;top:96px;bottom:140px" />
          <div class="absolute left-1/2 top-0 bottom-0 w-px bg-primary-400/40" />
          <div class="absolute top-1/2 left-0 right-0 h-px bg-primary-400/40" />
        </div>
      </div>
    </div>
  </div>
</template>
