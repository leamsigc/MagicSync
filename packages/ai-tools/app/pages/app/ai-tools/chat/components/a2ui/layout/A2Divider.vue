<script setup lang="ts">
interface Props {
  definition: {
    id: string
    orientation?: 'horizontal' | 'vertical'
  }
}

const props = defineProps<Props>()
</script>

<template>
  <div
    class="a2ui-divider"
    :class="[
      definition.orientation === 'vertical' ? 'w-px h-full bg-neutral-200 dark:bg-neutral-700' : 'h-px w-full bg-neutral-200 dark:bg-neutral-700',
    ]"
  />
</template>
