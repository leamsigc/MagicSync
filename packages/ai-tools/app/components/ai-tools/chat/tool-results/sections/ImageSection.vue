<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { effectiveCall, parseSectionPayload, type ToolCallLike } from '../../../../../composables/ai-tools/chat/runSections'

const props = defineProps<{
  calls: ToolCallLike[]
}>()

const { t } = useI18n()

interface DesignEntry {
  id?: string
  title: string
  url?: string
  width?: number
  height?: number
}

function stringOf(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' ? value : undefined
}

function recordsOf(call: ToolCallLike): Record<string, unknown>[] {
  const payload = parseSectionPayload(effectiveCall(call).result)
  if (!payload) return []
  for (const key of ['images', 'results', 'items', 'designs']) {
    const list = payload[key]
    if (Array.isArray(list)) return list as Record<string, unknown>[]
  }
  return [payload]
}

function entryOf(record: Record<string, unknown>): DesignEntry {
  return {
    id: stringOf(record, 'id') ?? stringOf(record, 'assetId') ?? stringOf(record, 'designId'),
    title: stringOf(record, 'title') ?? stringOf(record, 'source') ?? stringOf(record, 'name') ?? t('workflow.image.untitled'),
    url: stringOf(record, 'url') ?? stringOf(record, 'assetUrl') ?? stringOf(record, 'imageUrl'),
    width: numberField(record, 'width'),
    height: numberField(record, 'height'),
  }
}

const entries = computed(() => props.calls.flatMap(call => recordsOf(call).map(entryOf)))
const designs = computed(() => entries.value.filter(entry => entry.url || entry.id))

function editorLink(id: string): string {
  return `/tools/image-editor?designId=${encodeURIComponent(id)}`
}

function sizeLabel(entry: DesignEntry): string {
  return entry.width && entry.height ? `${entry.width} × ${entry.height}` : ''
}
</script>

<template>
  <section
    v-motion-fade
    data-testid="run-section"
    data-kind="image"
    :duration="200"
    class="overflow-hidden rounded-xl border border-default bg-default"
  >
    <div v-for="call in calls" :key="call.id">
      <div v-if="call.error" class="m-3 rounded-xl bg-error/10 p-3">
        <p class="text-sm whitespace-pre-wrap text-error/90">{{ call.error }}</p>
      </div>
    </div>

    <template v-if="designs.length > 0">
      <div class="flex items-center justify-between border-b border-default px-4 py-2.5">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('workflow.image.title') }}</p>
        <UBadge color="neutral" variant="subtle" size="xs">{{ t('workflow.image.count', { count: designs.length }) }}</UBadge>
      </div>
      <div class="grid gap-3 p-3 sm:grid-cols-2">
        <figure
          v-for="(entry, index) in designs"
          :key="`${entry.id ?? entry.url ?? index}`"
          class="overflow-hidden rounded-xl border border-default bg-elevated"
        >
          <div class="flex min-h-32 items-center justify-center bg-default">
            <img
              v-if="entry.url"
              :src="entry.url"
              :alt="entry.title"
              class="max-h-80 w-full object-contain"
              loading="lazy"
            >
            <div v-else class="flex flex-col items-center gap-2 p-6 text-center">
              <UIcon name="i-heroicons-photo" class="size-8 text-muted" />
              <p class="text-xs text-muted">{{ t('workflow.image.notRendered') }}</p>
            </div>
          </div>
          <figcaption class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-3 py-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-highlighted">{{ entry.title }}</p>
              <p v-if="sizeLabel(entry)" class="text-xs text-muted">{{ sizeLabel(entry) }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <UButton
                v-if="entry.url"
                :to="entry.url"
                target="_blank"
                rel="noopener"
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-heroicons-arrow-down-tray"
                :label="t('workflow.image.download')"
              />
              <UButton
                v-if="entry.id"
                :to="editorLink(entry.id)"
                size="xs"
                variant="outline"
                color="neutral"
                icon="i-heroicons-pencil-square"
                :label="t('workflow.image.openEditor')"
              />
            </div>
          </figcaption>
        </figure>
      </div>
    </template>

    <div v-else-if="calls.every(call => !call.error)" class="p-4 text-sm text-muted">
      {{ t('workflow.image.empty') }}
    </div>
  </section>
</template>
