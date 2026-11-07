<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { effectiveCall, parseSectionPayload, type ToolCallLike } from '../../../../../composables/ai-tools/chat/runSections'
import { accountForTab, buildPostPayload, platformLabel, type PostTab, type SocialAccount } from './draftPreview'

interface ComposePayload {
  content: string
  accounts: Array<{ id: string, platform: string }>
  platformVariants?: Record<string, string>
}

const props = defineProps<{
  call: ToolCallLike
  accounts: SocialAccount[]
  businessId?: string | null
  index: number
  total: number
}>()

const emit = defineEmits<{
  compose: [payload: ComposePayload]
}>()

const { t } = useI18n()
const toast = useToast()
const selectedTab = ref('')
const busyKey = ref<string | null>(null)
const showAccounts = ref(false)

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function payloadOf(): Record<string, unknown> {
  return parseSectionPayload(effectiveCall(props.call).result) ?? {}
}

function draftOf(): Record<string, unknown> {
  const payload = payloadOf()
  return recordOf(payload.draft) ?? payload
}

function claimsOf(value: Record<string, unknown>): string[] {
  return Array.isArray(value.claims)
    ? value.claims.filter((claim): claim is string => typeof claim === 'string').slice(0, 4)
    : []
}

function captionOf(value: unknown): string {
  if (typeof value === 'string') return value
  const caption = recordOf(value)?.caption
  return typeof caption === 'string' ? caption : ''
}

function requestedPlatforms(): string[] {
  const platforms = effectiveCall(props.call).args.platforms
  return Array.isArray(platforms) ? platforms.filter((platform): platform is string => typeof platform === 'string') : []
}

function targetIds(): string[] {
  const ids = effectiveCall(props.call).args.targetAccountIds
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
}

function accountsFor(platform: string): SocialAccount[] {
  const ids = targetIds()
  return props.accounts.filter(account => {
    if (ids.length > 0 && !ids.includes(account.id)) return false
    return account.platform?.toLowerCase() === platform.toLowerCase()
  })
}

function accountTab(platform: string, caption: string, claims: string[], account: SocialAccount, suffix: string): PostTab {
  return {
    id: `${props.call.id}-${platform}-${suffix}`,
    label: account.accountName ?? platformLabel(platform),
    platform,
    account: account.accountName,
    accountId: account.id,
    caption,
    claims,
  }
}

function tabsForPlatform(platform: string, caption: string, claims: string[]): PostTab[] {
  const targeted = accountsFor(platform)
  if (targeted.length === 0) {
    return [{ id: `${props.call.id}-${platform}`, label: platformLabel(platform), platform, caption, claims }]
  }
  return targeted.map(account => accountTab(platform, caption, claims, account, account.id))
}

function tabsOf(): PostTab[] {
  const draft = draftOf()
  const variants = recordOf(draft.platformVariants) ?? {}
  const claims = claimsOf(draft)
  const entries = Object.entries(variants).filter(([, value]) => captionOf(value).length > 0)
  if (entries.length > 0) {
    return entries.flatMap(([platform, value]) => tabsForPlatform(platform, captionOf(value), claims))
  }
  const caption = typeof draft.caption === 'string' ? draft.caption : ''
  if (!caption) return []
  const platforms = requestedPlatforms()
  if (platforms.length === 0) {
    return [{ id: props.call.id, label: t('workflow.defaultPostTab'), platform: 'social', caption, claims }]
  }
  return platforms.flatMap(platform => tabsForPlatform(platform, caption, claims))
}

const tabs = computed(tabsOf)
const activeTab = computed(() => tabs.value.find(tab => tab.id === selectedTab.value) ?? tabs.value[0] ?? null)

watch(tabs, (nextTabs) => {
  if (!nextTabs.some(tab => tab.id === selectedTab.value)) selectedTab.value = nextTabs[0]?.id ?? ''
}, { immediate: true })

function handleSelectTab(id: string): void {
  selectedTab.value = id
}

const activeAccount = computed(() => {
  if (!activeTab.value) return null
  return accountForTab(props.accounts, activeTab.value)
})

const isConnected = computed(() => activeAccount.value !== null)

const platformAccounts = computed(() => {
  const tab = activeTab.value
  if (!tab) return []
  if (tab.platform === 'social') return props.accounts
  const key = tab.platform.toLowerCase()
  return props.accounts.filter(account => account.platform?.toLowerCase() === key)
})

function notifyScheduleFailed(description?: string): void {
  toast.add({
    title: t('workflow.draft.scheduleFailed'),
    description,
    icon: 'i-heroicons-x-circle',
    color: 'error',
  })
}

async function submitPost(busy: string, status: 'scheduled' | 'published', scheduledAt: string): Promise<void> {
  const businessId = props.businessId
  const account = activeAccount.value
  const caption = activeTab.value?.caption
  if (!businessId || !account || !caption) {
    notifyScheduleFailed()
    return
  }
  busyKey.value = busy
  try {
    const at = new Date(scheduledAt).toISOString()
    await $fetch('/api/v1/posts', {
      method: 'POST',
      body: buildPostPayload({ businessId, caption, accountId: account.id, scheduledAt: at, status }),
    })
    toast.add({ title: t('workflow.draft.scheduled'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (error: unknown) {
    notifyScheduleFailed(error instanceof Error ? error.message : undefined)
  }
  finally {
    busyKey.value = null
  }
}

function handleScheduleNow(): void {
  void submitPost('schedule-now', 'scheduled', new Date().toISOString())
}

function handlePostNow(): void {
  void submitPost('post-now', 'published', new Date().toISOString())
}

function handleScheduleTimeframe(value: string): void {
  if (!value) {
    notifyScheduleFailed()
    return
  }
  void submitPost('schedule-timeframe', 'scheduled', value)
}

function handleSelectAccount(): void {
  if (props.accounts.length === 0) {
    return
  }
  showAccounts.value = !showAccounts.value
}

function variantsFor(): Record<string, string> {
  const variants = recordOf(draftOf().platformVariants) ?? {}
  return Object.fromEntries(
    Object.entries(variants)
      .map(([platform, value]) => [platform, captionOf(value)] as const)
      .filter(([, caption]) => caption.length > 0),
  )
}

/** Hand the draft to the full composer so it can be finished with real parity. */
function handleCompose(): void {
  const tab = activeTab.value
  if (!tab) return
  emit('compose', {
    content: tab.caption,
    platformVariants: variantsFor(),
    accounts: platformAccounts.value.map(account => ({ id: account.id, platform: account.platform ?? '' })),
  })
}

function handlePickAccount(id: string): void {
  const platform = activeTab.value?.platform
  const tab = tabs.value.find(entry => entry.accountId === id && entry.platform === platform)
  if (tab) selectedTab.value = tab.id
  showAccounts.value = false
}
</script>

<template>
  <article
    data-testid="draft-card"
    class="overflow-hidden rounded-xl border border-default bg-default"
  >
    <header v-if="total > 1" class="flex items-center justify-between border-b border-default px-4 py-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-muted">
        {{ t('workflow.draft.postLabel', { index, total }) }}
      </p>
      <UBadge color="neutral" variant="subtle" size="xs">{{ t('workflow.draftStatus') }}</UBadge>
    </header>

    <div v-if="call.error" class="m-3 rounded-xl bg-error/10 p-3">
      <p class="text-sm whitespace-pre-wrap text-error/90">{{ call.error }}</p>
    </div>

    <template v-if="tabs.length > 0 && activeTab">
      <div class="flex gap-1 overflow-x-auto border-b border-default px-3 pt-2" role="tablist" :aria-label="t('workflow.platformTabs')">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeTab.id === tab.id"
          class="shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors"
          :class="activeTab.id === tab.id ? 'border-primary text-highlighted' : 'border-transparent text-muted hover:text-highlighted'"
          @click="handleSelectTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="space-y-4 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-primary">{{ platformLabel(activeTab.platform) }}</p>
            <p v-if="activeTab.account" class="mt-1 text-xs text-muted">{{ activeTab.account }}</p>
          </div>
          <div class="flex items-center gap-2">
            <UBadge color="neutral" variant="subtle" size="xs">{{ t('workflow.draftStatus') }}</UBadge>
            <UButton
              size="xs"
              variant="outline"
              color="neutral"
              icon="i-heroicons-pencil-square"
              data-testid="draft-open-editor"
              @click="handleCompose"
            >
              {{ t('workflow.draft.openEditor') }}
            </UButton>
          </div>
        </div>
        <DraftPreviewCard
          :tab="activeTab"
          :account="activeAccount"
          :connected="isConnected"
          :busy-key="busyKey"
          @schedule-now="handleScheduleNow"
          @post-now="handlePostNow"
          @schedule-timeframe="handleScheduleTimeframe"
          @select-account="handleSelectAccount"
        />
        <div v-if="showAccounts" v-motion-fade :duration="200" class="rounded-xl border border-default bg-elevated p-2">
          <button
            v-for="option in platformAccounts"
            :key="option.id"
            type="button"
            class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-default"
            @click="handlePickAccount(option.id)"
          >
            <UAvatar :alt="option.accountName ?? option.id" size="xs" />
            <span class="font-medium">{{ option.accountName ?? option.id }}</span>
            <span v-if="option.platform" class="truncate text-muted">{{ platformLabel(option.platform) }}</span>
          </button>
          <p v-if="platformAccounts.length === 0" class="p-2 text-xs text-muted">
            {{ t('workflow.draft.connectPrompt', { platform: platformLabel(activeTab.platform) }) }}
          </p>
        </div>
        <div v-if="activeTab.claims.length > 0" class="rounded-xl border border-default bg-elevated p-3">
          <p class="text-xs font-semibold text-muted">{{ t('workflow.claims') }}</p>
          <ul class="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
            <li v-for="claim in activeTab.claims" :key="claim">{{ claim }}</li>
          </ul>
        </div>
      </div>
    </template>
    <div v-else-if="!call.error" class="p-4 text-sm text-muted">
      {{ t('workflow.noOutput') }}
    </div>
  </article>
</template>
