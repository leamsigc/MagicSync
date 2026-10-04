<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
/**
 * One collapsible section of the idea rail (PRD-CONTENT-PIPELINE-OVERHAUL §10
 * D05). The rail is the point: it stays put while a long article scrolls, so
 * every section here can be folded away and still be one press from open.
 *
 * The whole trigger row is the button, so keyboard and pointer reach it alike,
 * and the body mounts on open — a folded section costs nothing.
 */

const open = defineModel<boolean>({ required: true })

defineProps<{
  title: string
  icon: string
  testid: string
  /** A short count or label on the right of the trigger, e.g. failing checks. */
  badge?: string
  /** Anchors a shortcut in the rail can scroll to. */
  anchor?: string
}>()

const { t } = useI18n()
</script>

<template>
  <UCollapsible
    v-model:open="open"
    :id="anchor"
    :data-testid="testid"
    class="rounded-xl border border-default bg-default"
    :ui="{ content: 'overflow-hidden' }"
  >
    <template #default>
      <UButton
        variant="ghost"
        color="neutral"
        block
        :aria-label="`${title} — ${open ? t('rail.collapse') : t('rail.expand')}`"
        :data-testid="`${testid}-toggle`"
        :ui="{ base: 'justify-start gap-2 px-3 py-2.5' }"
      >
        <UIcon :name="icon" class="size-4 shrink-0 text-muted" aria-hidden />
        <span class="text-xs font-semibold uppercase tracking-wider text-muted">{{ title }}</span>
        <UBadge v-if="badge" color="neutral" variant="subtle" size="xs" class="ml-auto">
          {{ badge }}
        </UBadge>
        <UIcon
          name="i-heroicons-chevron-down"
          class="size-4 shrink-0 text-muted transition-transform duration-200"
          :class="open ? 'rotate-180' : ''"
          aria-hidden
        />
      </UButton>
    </template>

    <template #content>
      <div v-motion-slide-bottom :duration="200" class="border-t border-default px-3 py-3" :data-testid="`${testid}-body`">
        <slot />
      </div>
    </template>
  </UCollapsible>
</template>