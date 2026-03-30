<script setup lang="ts">
interface Props {
  definition: {
    id: string
    child?: string
    children?: { explicitList?: string[] } | string[]
    padding?: number
    backgroundColor?: string
    elevation?: 'none' | 'sm' | 'md' | 'lg'
    borderRadius?: number
  }
  surfaceId?: string
}

const props = defineProps<Props>()

const childIds = computed(() => {
  if (props.definition.child) return [props.definition.child]
  if (Array.isArray(props.definition.children)) return props.definition.children
  return props.definition.children?.explicitList || []
})
</script>

<template>
  <UCard
    class="a2ui-card"
    :style="{
      borderRadius: definition.borderRadius ? `${definition.borderRadius}px` : undefined,
    }"
  >
    <div
      :style="{
        padding: definition.padding ? `${definition.padding}px` : undefined,
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
  </UCard>
</template>
