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

const justifyContent = computed(() => {
  switch (props.definition.alignment) {
    case 'center': return 'justify-center'
    case 'end': return 'justify-end'
    case 'stretch': return 'justify-stretch'
    default: return 'justify-start'
  }
})
</script>

<template>
  <div
    class="a2ui-row flex flex-row"
    :class="[justifyContent]"
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
