<i18n src="./BaseCollection.json"></i18n>
<script lang="ts" setup>
/**
 * Shared empty state. One component so every collection surface shows the same
 * icon/title/hint/CTA instead of a bare "No data" line.
 */
interface Props {
  icon?: string
  title?: string
  hint?: string
  /** Set false when the empty state already sits inside a bordered container (e.g. a table). */
  bordered?: boolean
}

withDefaults(defineProps<Props>(), {
  icon: 'i-lucide-inbox',
  title: '',
  hint: '',
  bordered: true,
})

const { t } = useI18n()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-16 text-center"
    :class="bordered ? 'border border-default' : ''"
    v-motion-fade
    :duration="200"
  >
    <UIcon :name="icon" class="size-10 text-dimmed" />
    <p class="font-medium text-highlighted">{{ title || t('empty_title') }}</p>
    <p v-if="hint" class="max-w-sm text-sm text-muted">{{ hint }}</p>
    <div v-if="$slots.default" class="mt-3">
      <slot />
    </div>
  </div>
</template>
