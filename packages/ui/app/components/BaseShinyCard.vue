<script lang="ts" setup>
/**
 *
 * Component Description:Desc
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { useMouseInElement } from '@vueuse/core'

interface Props {
  class?: string
  showBg?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  showBg: true,
  class: ''
})
const target = ref()

const { elementX, elementY } = useMouseInElement(target)
const cssVars = computed(() => ({
  '--x': `${target.value ? elementX.value : -1000}px`,
  '--y': `${target.value ? elementY.value : -1000}px`
}))
</script>

<template>
  <div ref="target" :style="cssVars" class="rounded-xl  shine relative" :class="[props.class || '']">
    <div
      class=" w-full h-full bg-linear-to-b from-neutral-800/95 to-neutral-950/5 dark:from-neutral-700/95 dark:to-neutral-900/5 bg-neutral-950/80 absolute -z-10 pointer-events-none"
      :class="props.showBg ? ' dark:opacity-100' : 'opacity-5'" />
    <slot />
  </div>
</template>

<style scoped>
.shine {
  background-image: radial-gradient(300px circle at var(--x) var(--y),
      hsl(var(--primary)) 0,
      transparent 100%);
}
</style>
