<template>
  <div class="grid gap-6 my-8" :class="gridClass">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    columns?: 2 | 3 | 4
  }>(),
  {
    columns: 3
  }
)

const gridClass = computed(() => {
  return {
    'grid-cols-1 md:grid-cols-2': props.columns === 2,
    'grid-cols-1 md:grid-cols-2 lg:grid-cols-3': props.columns === 3,
    'grid-cols-1 md:grid-cols-2 lg:grid-cols-4': props.columns === 4
  }
})
</script>

<style scoped>
:deep(.feature-item) {
  @apply p-6 border border-[var(--vp-c-divider)] rounded-lg bg-[var(--vp-c-bg-soft)] transition-all duration-300;
}

:deep(.feature-item:hover) {
  @apply -translate-y-1 shadow-lg border-[var(--vp-c-brand-1)];
  box-shadow: 0 12px 32px rgba(225, 0, 152, 0.1);
}

:deep(.feature-icon) {
  @apply w-12 h-12 mb-4 flex items-center justify-center rounded-lg text-[var(--vp-c-brand-1)];
  background: linear-gradient(135deg, var(--vp-c-brand-soft) 0%, var(--vp-c-purple-soft, rgba(139, 92, 246, 0.14)) 100%);
}

:deep(.feature-icon svg) {
  @apply w-6 h-6;
}

:deep(.feature-title) {
  @apply m-0 mb-2 text-lg font-semibold text-[var(--vp-c-text-1)];
}

:deep(.feature-description) {
  @apply m-0 text-sm leading-relaxed text-[var(--vp-c-text-2)];
}

:deep(.feature-link) {
  @apply inline-flex items-center mt-3 text-sm font-medium text-[var(--vp-c-brand-1)] no-underline transition-colors duration-300;
}

:deep(.feature-link:hover) {
  @apply text-[var(--vp-c-brand-2)];
}

:deep(.feature-link svg) {
  @apply w-4 h-4 ml-1;
}
</style>
