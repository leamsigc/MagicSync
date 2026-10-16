<script lang="ts" setup>
// Vue casts an absent Boolean prop to `false`, so `props.defaultOpen ?? true`
// never sees `undefined` and every section would start collapsed. A real
// default is the only thing that survives boolean casting.
const props = withDefaults(defineProps<{
  title: string
  testid?: string
  defaultOpen?: boolean
}>(), { defaultOpen: true })

const open = ref(props.defaultOpen)

function toggle() {
  open.value = !open.value
}
</script>

<template>
  <section class="space-y-2" :data-testid="testid">
    <button
      type="button"
      class="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-muted hover:text-default transition-colors"
      :data-testid="testid ? `${testid}-toggle` : undefined"
      @click="toggle"
    >
      <span>{{ title }}</span>
      <UIcon
        :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        class="w-4 h-4"
      />
    </button>
    <div v-show="open" class="space-y-4">
      <slot />
    </div>
  </section>
</template>