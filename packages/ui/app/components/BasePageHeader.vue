<i18n src="./BaseCollection.json"></i18n>
<script lang="ts" setup>
/**
 * Page header shared by every collection/tool page.
 *
 * The back arrow is on by default (`/app`) because that is how the directory
 * pages have always worked; pass `back-to=""` to hide it.
 */
const { t } = useI18n()

interface Props {
  title: string
  description?: string
  backTo?: string
}

withDefaults(defineProps<Props>(), {
  description: '',
  backTo: '/app',
})
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
    <div class="flex min-w-0 items-start gap-2">
      <UButton v-if="backTo" variant="ghost" color="neutral" size="sm" :to="backTo" icon="i-lucide-arrow-left"
        :aria-label="t('back')" class="mt-0.5 shrink-0" />
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight md:text-3xl">
          <slot name="title">{{ title }}</slot>
        </h1>
        <p v-if="description || $slots.description" class="mt-1 max-w-2xl text-sm text-muted md:text-base">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>
    </div>

    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
      <slot name="actions" />
    </div>
  </div>
</template>
