<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
const props = defineProps<{
  content: string
}>()

const emit = defineEmits<{
  (event: 'prompt', value: string): void
}>()

const { t } = useI18n()

function handleNextAction(): void {
  emit('prompt', t('morningReport.nextPrompt'))
}
</script>

<template>
  <section v-motion-fade :duration="240" class="w-full max-w-[980px] overflow-hidden rounded-2xl border border-primary/25 bg-primary/5">
    <div class="flex items-center justify-between gap-3 border-b border-primary/15 px-4 py-3">
      <div class="flex min-w-0 items-center gap-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <UIcon name="i-heroicons-sun" class="h-5 w-5 text-primary" />
        </span>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-highlighted">{{ t('morningReport.title') }}</p>
          <p class="text-xs text-muted">{{ t('morningReport.subtitle') }}</p>
        </div>
      </div>
      <UBadge color="success" variant="subtle" size="xs">
        <UIcon name="i-heroicons-shield-check" class="mr-1 h-3.5 w-3.5" />
        {{ t('operator.safeMode') }}
      </UBadge>
    </div>
    <div class="p-4">
      <Markdown :value="props.content" class="chat-markdown text-sm" />
      <div class="mt-4 flex flex-wrap gap-2">
        <UButton color="primary" icon="i-heroicons-sparkles" @click="handleNextAction">
          {{ t('morningReport.nextAction') }}
        </UButton>
        <UBadge color="neutral" variant="outline" size="sm">{{ t('morningReport.noSideEffects') }}</UBadge>
      </div>
    </div>
  </section>
</template>
