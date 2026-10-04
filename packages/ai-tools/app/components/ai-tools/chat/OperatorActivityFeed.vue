<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import {
  useOperatorActivity,
  useOperatorClock,
} from '../../../composables/ai-tools/chat/useOperatorConsole'
import { isActiveActivity, relativeTime, type ActivityTone, type OperatorActivityItem } from '../../../composables/ai-tools/chat/operatorConsoleData'

const props = defineProps<{
  businessId?: string | null
  isStreaming?: boolean
}>()

const { t } = useI18n()
const now = useOperatorClock()
const { clear, clearing, items, load, loading, stop, stoppingId } = useOperatorActivity(() => props.businessId ?? undefined)

/** The feed starts folded: a long tail of past runs is noise until wanted. */
const expanded = ref(false)

const TONE_ICONS: Record<ActivityTone, string> = {
  idle: 'i-heroicons-sparkles',
  success: 'i-heroicons-check-circle',
  error: 'i-heroicons-exclamation-triangle',
}

const TONE_CLASSES: Record<ActivityTone, string> = {
  idle: 'text-muted',
  success: 'text-success',
  error: 'text-error',
}

onMounted(() => {
  void load()
})

watch(() => props.businessId, () => {
  void load()
})

watch(() => props.isStreaming, (streaming, previous) => {
  if (previous && !streaming) void load()
})

function timeLabel(at: string): string {
  const relative = relativeTime(at, now.value)
  return t(`activity.time.${relative.key}`, { count: relative.count })
}

function phraseLabel(key: string): string {
  return t(`activity.phrases.${key}`)
}

function handleToggle() {
  expanded.value = !expanded.value
}

const finishedCount = computed(() => items.value.filter(item => !isActiveActivity(item)).length)

function handleStop(item: OperatorActivityItem) {
  void stop(item)
}

/** Deleting history is worth a beat of hesitation, so it asks first. */
const confirmOpen = ref(false)

function handleAskClear() {
  if (finishedCount.value > 0) confirmOpen.value = true
}

function handleConfirmClear() {
  confirmOpen.value = false
  void clear()
}
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col border-t border-default" data-testid="operator-activity">
    <header class="flex items-center justify-between gap-2 px-2 py-2">
      <UButton
        variant="ghost"
        color="neutral"
        size="xs"
        class="px-2"
        :aria-expanded="expanded"
        data-testid="operator-activity-toggle"
        @click="handleToggle"
      >
        <span class="text-xs font-semibold uppercase tracking-wide text-muted">
          {{ t('activity.title') }}
        </span>
        <UBadge
          v-if="items.length"
          size="xs"
          variant="soft"
          color="neutral"
          :label="String(items.length)"
        />
        <UIcon
          name="i-heroicons-chevron-down"
          class="size-3.5 transition-transform"
          :class="expanded ? '' : '-rotate-90'"
        />
      </UButton>
      <div class="flex items-center">
        <UButton
          icon="i-heroicons-trash"
          variant="ghost"
          color="neutral"
          size="xs"
          :disabled="finishedCount === 0"
          :aria-label="t('activity.clear')"
          data-testid="operator-activity-clear"
          @click="handleAskClear"
        />
        <UButton
          icon="i-heroicons-arrow-path"
          variant="ghost"
          color="neutral"
          size="xs"
          :loading="loading"
          :aria-label="t('activity.refresh')"
          @click="load"
        />
      </div>
    </header>

    <UCollapsible v-model:open="expanded" :ui="{ content: 'flex min-h-0 flex-col' }">

      <template #content>
        <p v-if="loading && items.length === 0" v-motion-fade :duration="200" class="px-3 pb-3 text-xs text-muted">
          {{ t('activity.loading') }}
        </p>
        <p v-else-if="items.length === 0" v-motion-fade :duration="200" class="px-3 pb-3 text-xs text-muted">
          {{ t('activity.empty') }}
        </p>

        <ul v-else class="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-2 pb-4">
      <li
        v-for="item in items"
        :key="item.id"
        v-motion-fade
        :duration="200"
        class="flex items-start gap-2"
      >
        <UIcon
          :name="TONE_ICONS[item.tone]"
          :class="TONE_CLASSES[item.tone]"
          class="mt-0.5 size-4 shrink-0"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm leading-5 text-highlighted">{{ phraseLabel(item.phraseKey) }}</p>
          <p v-if="item.detail" class="line-clamp-2 text-xs leading-4 text-muted">
            {{ item.detail }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1.5 pt-0.5">
          <span class="text-[11px] text-muted">{{ timeLabel(item.at) }}</span>
          <UButton
            v-if="isActiveActivity(item)"
            size="2xs"
            variant="soft"
            color="error"
            icon="i-heroicons-stop"
            :label="t('activity.stop')"
            :loading="stoppingId === item.id"
            :data-testid="`operator-activity-stop-${item.id}`"
            @click="handleStop(item)"
          />
        </div>
        </li>
        </ul>
      </template>
    </UCollapsible>

    <UModal v-model:open="confirmOpen" :title="t('activity.clearTitle')" :ui="{ content: 'sm:max-w-sm' }">
      <template #body>
        <p class="text-sm text-muted">{{ t('activity.clearHint', { count: finishedCount }) }}</p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" :label="t('activity.clearCancel')" @click="confirmOpen = false" />
          <UButton
            color="error"
            icon="i-heroicons-trash"
            :label="t('activity.clearConfirm')"
            :loading="clearing"
            data-testid="operator-activity-clear-confirm"
            @click="handleConfirmClear"
          />
        </div>
      </template>
    </UModal>
  </section>
</template>
