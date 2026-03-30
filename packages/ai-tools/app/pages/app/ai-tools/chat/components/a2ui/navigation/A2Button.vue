<script setup lang="ts">
interface Props {
  definition: {
    id: string
    label?: string
    text?: string
    variant?: 'primary' | 'default' | 'borderless'
    action?: string
    icon?: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  action: [payload: { action: string; componentId: string }]
}>()

const label = computed(() => props.definition.label || props.definition.text || 'Button')
const color = computed(() => props.definition.variant === 'primary' ? 'primary' : 'neutral')
const variant = computed(() => {
  switch (props.definition.variant) {
    case 'borderless': return 'ghost'
    default: return 'solid'
  }
})

function handleClick() {
  emit('action', {
    action: props.definition.action || 'click',
    componentId: props.definition.id,
  })
}
</script>

<template>
  <UButton
    :label="label"
    :color="color"
    :variant="variant"
    :icon="definition.icon"
    @click="handleClick"
  />
</template>
