<script lang="ts" setup>
const props = defineProps<{
  title: string
  testid?: string
  defaultOpen?: boolean
}>()

const open = ref(props.defaultOpen ?? true)
</script>

<template>
  <section class="space-y-2" :data-testid="testid">
    <button
      type="button"
      class="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-muted hover:text-default transition-colors"
      :data-testid="testid ? `${testid}-toggle` : undefined"
      @click="open = !open"
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