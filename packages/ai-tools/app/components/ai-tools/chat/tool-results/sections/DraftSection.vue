<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { parseSectionPayload, type ToolCallLike } from '../../../../../composables/ai-tools/chat/runSections'
import { accountForTab, buildPostPayload, platformLabel, type PostTab, type SocialAccount } from './draftPreview'

const props = defineProps<{
  calls: ToolCallLike[]
  businessId?: string | null
}>()

const { t } = useI18n()
const toast = useToast()
const accounts = ref<SocialAccount[]>([])
const selectedTab = ref('')
const busyKey = ref<string | null>(null)
const showAccounts = ref(false)

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function payloadOf(call: ToolCallLike): Record<string, unknown> {
  return parseSectionPayload(call.result) ?? {}
}

function draftOf(call: ToolCallLike): Record<string, unknown> {
  const payload = payloadOf(call)
  return recordOf(payload.draft) ?? payload
}

function claimsOf(value: Record<string, unknown>): string[] {
  return Array.isArray(value.claims)
    ? value.claims.filter((claim): claim is string => typeof claim === 'string').slice(0, 4)
    : []
}

function accountsFor(platform: string, call: ToolCallLike): SocialAccount[] {
  const targetIds = Array.isArray(call.args?.targetAccountIds)
    ? call.args.targetAccountIds.filter((id): id is string => typeof id === 'string')
    : []
  return accounts.value.filter(account => {
    if (targetIds.length > 0 && !targetIds.includes(account.id)) return false
    return account.platform?.toLowerCase() === platform.toLowerCase()
  })
}

function tabsOf(call: ToolCallLike): PostTab[] {
  const payload = draftOf(call)
  const variants = recordOf(payload.platformVariants) ?? {}
  const variantEntries = Object.entries(variants).filter(([, value]) => typeof value === 'string')
  const claims = claimsOf(payload)
  if (variantEntries.length === 0 && typeof payload.caption === 'string') {
    return [{ id: call.id, label: t('workflow.defaultPostTab'), platform: 'social', caption: payload.caption, claims }]
  }
  return variantEntries.flatMap(([platform, value]) => {
    const targetedAccounts = accountsFor(platform, call)
    if (targetedAccounts.length === 0) {
      return [{ id: `${call.id}-${platform}`, label: platformLabel(platform), platform, caption: String(value), claims }]
    }
    return targetedAccounts.map(account => ({
      id: `${call.id}-${platform}-${account.id}`,
      label: account.accountName ?? platformLabel(platform),
      platform,
      account: account.accountName,
      accountId: account.id,
      caption: String(value),
      claims,
    }))
  })
}

const tabs = computed(() => props.calls.flatMap(tabsOf))
const activeTab = computed(() => tabs.value.find(tab => tab.id === selectedTab.value) ?? tabs.value[0] ?? null)

watch(tabs, (nextTabs) => {
  if (!nextTabs.some(tab => tab.id === selectedTab.value)) selectedTab.value = nextTabs[0]?.id ?? ''
}, { immediate: true })

function handleSelectTab(id: string): void {
  selectedTab.value = id
}

const activeAccount = computed(() => {
  if (!activeTab.value) return null
  return accountForTab(accounts.value, activeTab.value)
})

const isConnected = computed(() => activeAccount.value !== null)

const platformAccounts = computed(() => {
  const tab = activeTab.value
  if (!tab) return []
  if (tab.platform === 'social') return accounts.value
  const key = tab.platform.toLowerCase()
  return accounts.value.filter(account => account.platform?.toLowerCase() === key)
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
  if (accounts.value.length === 0) {
    void reloadAccountsForSelect()
    return
  }
  showAccounts.value = !showAccounts.value
}

async function reloadAccountsForSelect(): Promise<void> {
  busyKey.value = 'select-account'
  try {
    await loadAccounts()
  }
  finally {
    busyKey.value = null
    showAccounts.value = true
  }
}

function handlePickAccount(id: string): void {
  const platform = activeTab.value?.platform
  const tab = tabs.value.find(entry => entry.accountId === id && entry.platform === platform)
  if (tab) selectedTab.value = tab.id
  showAccounts.value = false
}

async function loadAccounts(): Promise<void> {
  if (!props.businessId) return
  try {
    const response = await $fetch<SocialAccount[] | { data?: SocialAccount[] }>('/api/v1/social-accounts', {
      query: { businessId: props.businessId },
    })
    accounts.value = Array.isArray(response) ? response : (response.data ?? [])
  }
  catch {
    accounts.value = []
  }
}

onMounted(() => {
  void loadAccounts()
})

watch(() => props.businessId, () => {
  void loadAccounts()
})
</script>

<template>
  <section v-motion-fade data-testid="run-section" data-kind="draft" :duration="200" class="overflow-hidden rounded-xl border border-default bg-default">
    <div v-for="call in calls" :key="call.id">
      <div v-if="call.error" class="m-3 rounded-xl bg-error/10 p-3">
        <p class="text-sm whitespace-pre-wrap text-error/90">{{ call.error }}</p>
      </div>
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
          <UBadge color="neutral" variant="subtle" size="xs">{{ t('workflow.draftStatus') }}</UBadge>
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
    <div v-else-if="calls.every(call => !call.error)" class="p-4 text-sm text-muted">
      {{ t('workflow.noOutput') }}
    </div>
  </section>
</template>
