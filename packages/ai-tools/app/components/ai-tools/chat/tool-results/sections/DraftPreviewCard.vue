<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { chromeFor, platformLabel, type PostTab, type SocialAccount } from './draftPreview'

const props = defineProps<{
  tab: PostTab
  account: SocialAccount | null
  connected: boolean
  busyKey: string | null
}>()

const emit = defineEmits<{
  (e: 'schedule-now'): void
  (e: 'post-now'): void
  (e: 'schedule-timeframe', value: string): void
  (e: 'select-account'): void
}>()

const { t } = useI18n()
const chrome = computed(() => chromeFor(props.tab.platform))
const displayName = computed(() => props.account?.accountName ?? props.tab.account ?? props.tab.label)

function handleScheduleNow(): void {
  emit('schedule-now')
}

function handlePostNow(): void {
  emit('post-now')
}

function handleScheduleTimeframe(value: string): void {
  emit('schedule-timeframe', value)
}

function handleSelectAccount(): void {
  emit('select-account')
}
</script>

<template>
  <div v-motion-fade :duration="200">
    <div v-if="!connected" class="flex flex-col items-start gap-2 rounded-xl border border-default bg-elevated p-4">
      <UIcon name="i-heroicons-link" class="h-5 w-5 text-muted" aria-hidden="true" />
      <p class="text-sm text-muted">{{ t('workflow.draft.connectPrompt', { platform: platformLabel(tab.platform) }) }}</p>
      <NuxtLink to="/app/integrations" class="text-sm font-medium text-primary hover:underline">
        {{ t('workflow.draft.connectCta') }}
      </NuxtLink>
    </div>
    <div v-else class="rounded-xl border border-default bg-elevated">
      <div v-if="chrome.variant === 'channel'" class="p-4">
        <div class="flex items-center gap-2 border-b border-default pb-3">
          <UIcon name="i-heroicons-hashtag" class="h-4 w-4 text-muted" aria-hidden="true" />
          <p class="text-sm font-semibold text-highlighted">{{ displayName }}</p>
        </div>
        <div class="mt-3 flex items-start gap-2">
          <UAvatar :alt="displayName" size="sm" />
          <Markdown :value="tab.caption" class="rounded-lg bg-default p-2.5 text-sm leading-6" />
        </div>
      </div>
      <div v-else-if="chrome.variant === 'vertical'" class="p-4">
        <div class="mx-auto flex min-h-72 max-w-60 flex-col justify-end rounded-2xl bg-neutral-950 p-3">
          <div class="flex items-center gap-2">
            <UAvatar :alt="displayName" size="sm" />
            <p class="truncate text-xs font-semibold text-white">{{ displayName }}</p>
          </div>
          <Markdown :value="tab.caption" class="mt-2 text-xs leading-5 text-white" />
        </div>
      </div>
      <div v-else class="flex gap-2 p-4">
        <div v-if="chrome.upvote" class="flex flex-col items-center gap-1 pt-1">
          <UIcon name="i-heroicons-chevron-up" class="h-5 w-5 text-muted" aria-hidden="true" />
          <UIcon name="i-heroicons-chevron-down" class="h-5 w-5 text-muted" aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <UAvatar :alt="displayName" size="md" />
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-highlighted">{{ displayName }}</p>
              <p class="text-xs text-muted">{{ platformLabel(tab.platform) }}</p>
            </div>
          </div>
          <Markdown :value="tab.caption" class="mt-3 text-sm leading-6" />
        </div>
      </div>
      <div class="flex items-center gap-4 border-t border-default px-4 py-2.5" aria-hidden="true">
        <UIcon v-for="icon in chrome.actions" :key="icon" :name="icon" class="h-4 w-4 text-muted" />
      </div>
      <div class="border-t border-default p-3">
        <DraftActionBar
          :busy-key="busyKey"
          @schedule-now="handleScheduleNow"
          @post-now="handlePostNow"
          @schedule-timeframe="handleScheduleTimeframe"
          @select-account="handleSelectAccount"
        />
      </div>
    </div>
  </div>
</template>
