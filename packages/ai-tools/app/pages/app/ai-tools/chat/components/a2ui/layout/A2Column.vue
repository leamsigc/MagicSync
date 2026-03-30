<script setup lang="ts">
interface Props {
  definition: {
    id: string
    children?: { explicitList?: string[] } | string[]
    padding?: number
    gap?: number
    alignment?: 'start' | 'center' | 'end' | 'stretch'
  }
  surfaceId?: string
}

const props = defineProps<Props>()

const childIds = computed(() => {
  if (Array.isArray(props.definition.children)) return props.definition.children
  return props.definition.children?.explicitList || []
})

const alignItems = computed(() => {
  switch (props.definition.alignment) {
    case 'center': return 'items-center'
    case 'end': return 'items-end'
    case 'stretch': return 'items-stretch'
    default: return 'items-start'
  }
})
</script>

<template>
  <div
    class="a2ui-column flex flex-col"
    :class="[alignItems]"
    :style="{
      padding: definition.padding ? `${definition.padding}px` : undefined,
      gap: definition.gap ? `${definition.gap}px` : '8px',
    }"
  >
    <A2Renderer
      v-for="childId in childIds"
      :key="childId"
      :component-id="childId"
      :surface-id="surfaceId || ''"
    />
    <slot />
  </div>
</template>
