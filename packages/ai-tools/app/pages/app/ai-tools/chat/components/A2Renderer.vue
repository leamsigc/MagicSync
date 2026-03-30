<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'

interface Props {
  componentId: string
  surfaceId: string
  components?: Record<string, any>
}

const props = defineProps<Props>()

// Lazy-loaded component map
const componentMap: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  // Layout
  Row: defineAsyncComponent(() => import('./a2ui/layout/A2Row.vue')),
  Column: defineAsyncComponent(() => import('./a2ui/layout/A2Column.vue')),
  Card: defineAsyncComponent(() => import('./a2ui/layout/A2Card.vue')),
  Divider: defineAsyncComponent(() => import('./a2ui/layout/A2Divider.vue')),
  // Content
  Text: defineAsyncComponent(() => import('./a2ui/content/A2Text.vue')),
  Image: defineAsyncComponent(() => import('./a2ui/content/A2Image.vue')),
  Icon: defineAsyncComponent(() => import('./a2ui/content/A2Icon.vue')),
  Badge: defineAsyncComponent(() => import('./a2ui/content/A2Badge.vue')),
  Alert: defineAsyncComponent(() => import('./a2ui/content/A2Alert.vue')),
  Progress: defineAsyncComponent(() => import('./a2ui/content/A2Progress.vue')),
  // Navigation
  Button: defineAsyncComponent(() => import('./a2ui/navigation/A2Button.vue')),
}

const definition = computed(() => {
  if (!props.components) return null
  return props.components[props.componentId] || null
})

const componentType = computed(() => {
  const def = definition.value
  if (!def) return null
  // v0.10 format: { id, component: "Text", text: ... }
  if (typeof def.component === 'string') return def.component
  // v0.8 format: { id, component: { Text: { text: ... } } }
  if (typeof def.component === 'object') {
    return Object.keys(def.component)[0]
  }
  return null
})

const normalizedDef = computed(() => {
  const def = definition.value
  if (!def) return null
  // v0.10 format: already flat
  if (typeof def.component === 'string') return def
  // v0.8 format: { id, component: { Text: { text: ... } } }
  if (typeof def.component === 'object') {
    const type = Object.keys(def.component)[0]
    const inner = (def.component as any)[type]
    return { ...inner, id: def.id, component: type }
  }
  return def
})

const resolvedComponent = computed(() => {
  const type = componentType.value
  if (!type) return null
  return componentMap[type] || null
})

const weightStyle = computed(() => {
  const def = normalizedDef.value
  if (def?.weight !== undefined) {
    return { flex: `${def.weight} 1 0%` }
  }
  return {}
})
</script>

<template>
  <component
    v-if="resolvedComponent && normalizedDef"
    :is="resolvedComponent"
    :definition="normalizedDef"
    :surface-id="surfaceId"
    :style="weightStyle"
  />
  <div
    v-else-if="componentType"
    class="p-2 text-xs rounded border border-dashed border-neutral-300 text-neutral-500"
  >
    Unknown component: {{ componentType }}
  </div>
</template>
