<script setup lang="ts">
interface Props {
  definition: {
    id: string
    name?: string
    size?: number
    color?: string
  }
}

const props = defineProps<Props>()

const iconClass = computed(() => {
  const name = props.definition.name
  if (!name) return 'i-heroicons-question-mark-circle'
  if (name.includes(':')) return name
  return `i-heroicons-${name}`
})
</script>

<template>
  <UIcon
    :name="iconClass"
    :class="[
      definition.size ? `w-${definition.size} h-${definition.size}` : 'w-6 h-6',
    ]"
    :style="{ color: definition.color }"
  />
</template>
