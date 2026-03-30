<script setup lang="ts">
interface Props {
  definition: {
    id: string
    text?: string
    severity?: 'info' | 'success' | 'warning' | 'error'
    dismissible?: boolean
  }
}

const props = defineProps<Props>()

const color = computed(() => props.definition.severity || 'info')
const show = ref(true)

function handleDismiss() {
  show.value = false
}
</script>

<template>
  <UAlert
    v-if="show"
    :description="definition.text"
    :color="color"
    variant="soft"
    :close-button="definition.dismissible ? { icon: 'i-heroicons-x-mark', color: 'neutral', variant: 'ghost' } : undefined"
    @close="handleDismiss"
  />
</template>
