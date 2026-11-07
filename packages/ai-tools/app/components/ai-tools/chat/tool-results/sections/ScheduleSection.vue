<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { effectiveCall, parseSectionPayload, type ToolCallLike } from '../../../../../composables/ai-tools/chat/runSections'

const props = defineProps<{
  calls: ToolCallLike[]
}>()

const { t } = useI18n()

interface ScheduledItem {
  postId?: string
  platform: string
  accountId?: string
  scheduledAt?: string
}

interface ScheduleGroup {
  brief?: string
  items: ScheduledItem[]
  rejected: Array<{ platform: string, reason: string }>
  error?: string
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringOf(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function itemsOf(record: Record<string, unknown>): ScheduledItem[] {
  const items = record.items
  if (!Array.isArray(items)) return []
  return items.flatMap((raw): ScheduledItem[] => {
    const item = recordOf(raw)
    if (!item) return []
    return [{
      postId: stringOf(item, 'postId'),
      platform: stringOf(item, 'platform') ?? t('workflow.scheduleResult.unknownPlatform'),
      accountId: stringOf(item, 'accountId'),
      scheduledAt: stringOf(item, 'scheduledAt'),
    }]
  })
}

function rejectedOf(record: Record<string, unknown>): Array<{ platform: string, reason: string }> {
  const rejected = record.rejected
  if (!Array.isArray(rejected)) return []
  return rejected.flatMap((raw): Array<{ platform: string, reason: string }> => {
    const item = recordOf(raw)
    if (!item) return []
    return [{ platform: stringOf(item, 'platform') ?? '', reason: stringOf(item, 'reason') ?? '' }]
  })
}

function groupFromItems(record: Record<string, unknown>): ScheduleGroup | null {
  const items = itemsOf(record)
  if (items.length > 0) return { brief: stringOf(record, 'brief'), items, rejected: rejectedOf(record) }
  return null
}

function groupFromPost(record: Record<string, unknown>): ScheduleGroup | null {
  const postId = stringOf(record, 'postId')
  if (!postId) return null
  const platforms = Array.isArray(record.platforms) ? record.platforms.filter((entry): entry is string => typeof entry === 'string') : []
  return {
    items: [{
      postId,
      platform: platforms[0] ?? stringOf(record, 'platform') ?? t('workflow.scheduleResult.unknownPlatform'),
      scheduledAt: stringOf(record, 'scheduledAt'),
    }],
    rejected: [],
  }
}

function groupsOf(call: ToolCallLike): ScheduleGroup[] {
  const payload = parseSectionPayload(effectiveCall(call).result)
  if (!payload) return []
  const results = payload.results
  if (Array.isArray(results)) {
    return results.flatMap((raw): ScheduleGroup[] => {
      const record = recordOf(raw)
      if (!record) return []
      const group = groupFromItems(record)
      if (group) return [group]
      const error = stringOf(record, 'error')
      return error ? [{ items: [], rejected: [], error }] : []
    })
  }
  const group = groupFromItems(payload) ?? groupFromPost(payload)
  return group ? [group] : []
}

function formatTime(iso?: string): string {
  if (!iso) return t('workflow.scheduleResult.noTime')
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function platformLabel(platform: string): string {
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

const groups = computed(() => props.calls.flatMap(groupsOf))
const total = computed(() => groups.value.reduce((count, group) => count + group.items.length, 0))
</script>

<template>
  <section
    v-motion-fade
    data-testid="run-section"
    data-kind="schedule"
    :duration="200"
    class="overflow-hidden rounded-xl border border-default bg-default"
  >
    <div v-for="call in calls" :key="call.id">
      <div v-if="call.error" class="m-3 rounded-xl bg-error/10 p-3">
        <p class="text-sm whitespace-pre-wrap text-error/90">{{ call.error }}</p>
      </div>
    </div>

    <template v-if="groups.length > 0">
      <div class="flex items-center justify-between border-b border-default px-4 py-2.5">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('workflow.scheduleResult.title') }}</p>
        <div class="flex items-center gap-2">
          <UBadge color="success" variant="subtle" size="xs">{{ t('workflow.scheduleResult.created', { count: total }) }}</UBadge>
          <UButton
            to="/app/posts"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-arrow-top-right-on-square"
            :label="t('workflow.scheduleResult.view')"
          />
        </div>
      </div>

      <div class="space-y-3 p-3">
        <article
          v-for="(group, index) in groups"
          :key="index"
          class="rounded-xl border border-default bg-elevated p-3"
        >
          <p v-if="group.error" class="text-sm text-error">{{ group.error }}</p>
          <p v-if="group.brief" class="line-clamp-2 text-sm text-highlighted">{{ group.brief }}</p>
          <ul class="mt-2 space-y-1.5">
            <li
              v-for="(item, itemIndex) in group.items"
              :key="item.postId ?? itemIndex"
              class="flex flex-wrap items-center gap-2 text-xs text-muted"
            >
              <UBadge color="primary" variant="subtle" size="xs">{{ platformLabel(item.platform) }}</UBadge>
              <UIcon name="i-heroicons-clock" class="size-3.5" />
              <span>{{ formatTime(item.scheduledAt) }}</span>
              <span v-if="item.postId" class="truncate">· {{ item.postId }}</span>
            </li>
          </ul>
          <ul v-if="group.rejected.length > 0" class="mt-2 space-y-1">
            <li
              v-for="rejected in group.rejected"
              :key="`${rejected.platform}-${rejected.reason}`"
              class="flex items-start gap-1.5 text-xs text-warning"
            >
              <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 size-3.5 shrink-0" />
              <span>{{ platformLabel(rejected.platform) }}: {{ rejected.reason }}</span>
            </li>
          </ul>
        </article>
      </div>
    </template>

    <div v-else-if="calls.every(call => !call.error)" class="p-4 text-sm text-muted">
      {{ t('workflow.scheduleResult.empty') }}
    </div>
  </section>
</template>
