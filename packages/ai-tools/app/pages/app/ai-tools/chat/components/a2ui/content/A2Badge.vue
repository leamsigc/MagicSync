<script setup lang="ts">
interface Props {
  definition: {
    id: string
    text?: string
    severity?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
    variant?: 'pill' | 'dot'
  }
}

const props = defineProps<Props>()

const color = computed(() => {
  switch (props.definition.severity) {
    case 'success': return 'success'
    case 'warning': return 'warning'
    case 'error': return 'error'
    case 'info': return 'info'
    default: return 'neutral'
  }
})
</script>

<template>
  <UBadge
    :label="definition.text"
    :color="color"
    :variant="definition.variant === 'dot' ? 'dot' : 'soft'"
  />
</template>
