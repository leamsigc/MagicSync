<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { parseSectionPayload, type ToolCallLike } from '../../../../../composables/ai-tools/chat/runSections'

defineProps<{
  calls: ToolCallLike[]
}>()

const { t } = useI18n()

function entriesOf(call: ToolCallLike): Array<{ key: string, value: unknown }> {
  const payload = parseSectionPayload(call.result)
  if (!payload || Object.keys(payload).length === 0) return []
  return Object.entries(payload).map(([key, value]) => ({ key, value }))
}

function humanizeKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function listText(value: unknown[]): string {
  return value.map(entry => `• ${typeof entry === 'string' ? entry : String((entry as Record<string, unknown>)?.label ?? (entry as Record<string, unknown>)?.title ?? '')}`).slice(0, 5).join('\n')
}
</script>

<template>
  <section v-motion-fade data-testid="run-section" data-kind="delivery" :duration="200" class="space-y-1.5">
    <div v-for="call in calls" :key="call.id">
      <div v-if="call.error" class="rounded-xl bg-error/10 p-3">
        <p class="text-sm whitespace-pre-wrap text-error/90">{{ call.error }}</p>
      </div>
      <template v-else-if="entriesOf(call).length">
        <div v-for="entry in entriesOf(call)" :key="entry.key" class="rounded-xl bg-default p-3">
          <p class="text-xs font-medium text-muted">{{ humanizeKey(entry.key) }}</p>
          <Markdown v-if="typeof entry.value === 'string'" :value="entry.value.slice(0, 800)" class="mt-1 text-sm" />
          <Markdown v-else-if="Array.isArray(entry.value)" :value="listText(entry.value)" class="mt-1 text-sm" />
        </div>
      </template>
      <div v-else class="rounded-xl bg-default p-3">
        <p class="text-sm whitespace-pre-wrap text-muted">{{ call.result || t('workflow.noOutput') }}</p>
      </div>
    </div>
  </section>
</template>
