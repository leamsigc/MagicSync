<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'

interface A2UIComponent {
  id: string
  component: string | Record<string, any>
  [key: string]: any
}

interface Props {
  components: A2UIComponent[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  action: [payload: { action: string; componentId: string }]
}>()

// Lazy-loaded component map - same pattern as a2ui-vue
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

// Build a component map from the flat list
const componentRegistry = computed(() => {
  const map: Record<string, A2UIComponent> = {}
  for (const comp of props.components) {
    map[comp.id] = comp
  }
  return map
})

function getComponentType(comp: A2UIComponent): string | null {
  if (!comp) return null
  // v0.10 format: { id, component: "Text", text: ... }
  if (typeof comp.component === 'string') return comp.component
  // v0.8 format: { id, component: { Text: { text: ... } } }
  if (typeof comp.component === 'object') {
    return Object.keys(comp.component)[0]
  }
  return null
}

function getNormalizedDef(comp: A2UIComponent): Record<string, any> {
  if (!comp) return {}
  // v0.10 format: already flat
  if (typeof comp.component === 'string') return comp
  // v0.8 format: { id, component: { Text: { text: ... } } }
  if (typeof comp.component === 'object') {
    const type = Object.keys(comp.component)[0]
    const inner = (comp.component as any)[type]
    return { ...inner, id: comp.id, component: type }
  }
  return comp
}

function resolveComponent(type: string) {
  return componentMap[type] || null
}

function handleAction(payload: { action: string; componentId: string }) {
  emit('action', payload)
}

// Root components are those not referenced as children
const rootComponents = computed(() => {
  const childIds = new Set<string>()
  for (const comp of props.components) {
    const def = getNormalizedDef(comp)
    const children = def.children?.explicitList || []
    const child = def.child ? [def.child] : []
    for (const cid of [...children, ...child]) {
      childIds.add(cid)
    }
  }
  return props.components.filter(c => !childIds.has(c.id))
})
</script>

<template>
  <div class="a2ui-chat-renderer space-y-3">
    <template v-for="comp in rootComponents" :key="comp.id">
      <component
        v-if="resolveComponent(getComponentType(comp)!)"
        :is="resolveComponent(getComponentType(comp)!)"
        :definition="getNormalizedDef(comp)"
        :components="componentRegistry"
        @action="handleAction"
      />
      <div
        v-else-if="getComponentType(comp)"
        class="p-2 text-xs rounded border border-dashed border-neutral-300 text-neutral-500"
      >
        Unknown component: {{ getComponentType(comp) }}
      </div>
    </template>
  </div>
</template>
