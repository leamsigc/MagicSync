<script setup lang="ts">
interface Props {
  definition: {
    id: string
    text: string
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'body' | 'caption' | 'label'
    color?: string
    weight?: number
  }
}

const props = defineProps<Props>()
</script>

<template>
  <p
    :class="[
      'a2ui-text',
      {
        'text-3xl font-bold': definition.variant === 'h1',
        'text-2xl font-bold': definition.variant === 'h2',
        'text-xl font-semibold': definition.variant === 'h3',
        'text-lg font-semibold': definition.variant === 'h4',
        'text-base font-medium': definition.variant === 'h5',
        'text-base': definition.variant === 'body' || !definition.variant,
        'text-sm text-neutral-500': definition.variant === 'caption',
        'text-xs uppercase tracking-wider text-neutral-400': definition.variant === 'label',
      },
    ]"
    :style="{ color: definition.color }"
  >
    {{ definition.text }}
  </p>
</template>
