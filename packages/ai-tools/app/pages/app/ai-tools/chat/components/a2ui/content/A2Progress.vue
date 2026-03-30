<script setup lang="ts">
interface Props {
  definition: {
    id: string
    value?: number
    max?: number
    variant?: 'linear' | 'circular'
    label?: string
  }
}

const props = defineProps<Props>()

const max = computed(() => props.definition.max || 100)
const value = computed(() => props.definition.value || 0)
</script>

<template>
  <div class="a2ui-progress">
    <p v-if="definition.label" class="text-sm mb-1 text-neutral-600 dark:text-neutral-400">
      {{ definition.label }}
    </p>
    <UProgress :value="value" :max="max" />
  </div>
</template>
