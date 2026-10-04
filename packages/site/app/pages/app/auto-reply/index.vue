<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 * Auto-Reply campaign manager — comment-to-DM automation (Gap 16, PRD-AUTO-REPLY).
 * Instagram-first: keyword match → private-reply DM + optional public reply,
 * tracked links, logs. Phase B: instant delivery via Meta webhooks, story-DM
 * triggers, follow-gate enforcement.
 */
import { useAutoReply, type AutoReplyCampaign, type AutoReplyLog, type AutoReplyMediaItem } from '~/composables/useAutoReply'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const { campaigns, loading, error, fetchCampaigns, createCampaign, updateCampaign, deleteCampaign, fetchLogs, fetchStats, fetchWebhookStatus, subscribeWebhooks, fetchRecentMedia, testMatch } = useAutoReply()

const showForm = ref(false)
const editing = ref<AutoReplyCampaign | null>(null)
const formName = ref('')
const formAccount = ref('')
const formPosts = ref('')
const formMatchAll = ref(false)
const formKeywords = ref('LINK')
const formMode = ref<'whole' | 'partial'>('whole')
const formDm = ref('Hey {username}! Here is your link: {link1}')
const formLink1Label = ref('Get the link')
const formLink1Target = ref('')
const formLink2Label = ref('')
const formLink2Target = ref('')
const formPublicReply = ref('')
const formAi = ref(false)
const formStoryDm = ref(false)
const formFollowGate = ref(false)
const formFollowPrompt = ref('')
const webhookStatus = ref<{ verifyTokenConfigured: boolean; callbackUrl: string; appIdConfigured: boolean } | null>(null)
const subscribingId = ref<string | null>(null)
const accounts = ref<Array<{ id: string; accountName: string; platform: string }>>([])
const logsOpen = ref(false)
const activeLogs = ref<AutoReplyLog[]>([])
const activeCampaign = ref<AutoReplyCampaign | null>(null)
const statsText = ref('')
const testText = ref('')
const testResult = ref<string | null>(null)
const pickerOpen = ref(false)
const pickerLoading = ref(false)
const pickerItems = ref<AutoReplyMediaItem[]>([])
const pickerSelected = ref<string[]>([])

const presets = [
  { name: 'Link magnet', keywords: 'LINK, INFO', dm: 'Hey {username}! Here is your link: {link1}', pub: 'Sent you a DM!' },
  { name: 'Discount code', keywords: 'DISCOUNT, CODE', dm: 'Hey {username}! Your code is SAVE10 — shop here: {link1}', pub: 'Code sent to your DMs!' },
  { name: 'Webinar', keywords: 'WEBINAR, RSVP', dm: 'Hey {username}! Save your seat: {link1}', pub: 'Invite sent — check DMs!' },
]

function resetForm() {
  editing.value = null
  formName.value = ''
  formAccount.value = ''
  formPosts.value = ''
  formMatchAll.value = false
  formKeywords.value = 'LINK'
  formMode.value = 'whole'
  formDm.value = 'Hey {username}! Here is your link: {link1}'
  formLink1Label.value = 'Get the link'
  formLink1Target.value = ''
  formLink2Label.value = ''
  formLink2Target.value = ''
  formPublicReply.value = ''
  formAi.value = false
  formStoryDm.value = false
  formFollowGate.value = false
  formFollowPrompt.value = ''
}

function handleOpenCreate() {
  resetForm()
  showForm.value = true
}

function handleCloseForm() {
  showForm.value = false
  resetForm()
}

function handleApplyPreset(idx: number) {
  const p = presets[idx]
  if (!p) return
  formKeywords.value = p.keywords
  formDm.value = p.dm
  formPublicReply.value = p.pub
}

function handleEdit(c: AutoReplyCampaign) {
  editing.value = c
  formName.value = c.name
  formAccount.value = c.socialAccountId
  formPosts.value = (c.externalPostIds || []).join(', ')
  formMatchAll.value = !!c.matchAllPosts
  formKeywords.value = (c.keywords || []).join(', ')
  formMode.value = c.matchMode
  formDm.value = c.dmTemplate
  formLink1Label.value = c.links?.[0]?.label || ''
  formLink1Target.value = c.links?.[0]?.target || ''
  formLink2Label.value = c.links?.[1]?.label || ''
  formLink2Target.value = c.links?.[1]?.target || ''
  formPublicReply.value = c.publicReplyTemplate || ''
  formAi.value = c.mode === 'ai'
  formStoryDm.value = !!c.storyDmEnabled
  formFollowGate.value = !!c.followGate
  formFollowPrompt.value = c.followPromptTemplate || ''
  showForm.value = true
}

function buildPayload() {
  const links: Array<{ label: string; target: string }> = []
  if (formLink1Target.value.trim()) {
    links.push({ label: formLink1Label.value.trim() || 'Link 1', target: formLink1Target.value.trim() })
  }
  if (formLink2Target.value.trim()) {
    links.push({ label: formLink2Label.value.trim() || 'Link 2', target: formLink2Target.value.trim() })
  }
  return {
    name: formName.value.trim(),
    socialAccountId: formAccount.value,
    externalPostIds: formPosts.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
    matchAllPosts: formMatchAll.value,
    keywords: formKeywords.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10),
    matchMode: formMode.value,
    dmTemplate: formDm.value,
    links,
    publicReplyTemplate: formPublicReply.value.trim() || undefined,
    storyDmEnabled: formStoryDm.value,
    followGate: formFollowGate.value,
    followPromptTemplate: formFollowPrompt.value.trim() || undefined,
    enabled: true,
    mode: formAi.value ? 'ai' : 'template',
  }
}

async function handleSave() {
  try {
    const payload = buildPayload()
    if (editing.value) {
      await updateCampaign(editing.value.id, payload)
    } else {
      await createCampaign(payload)
    }
    toast.add({ title: t('save'), color: 'success' })
    handleCloseForm()
  } catch {
    toast.add({ title: t('no_match'), description: error.value || '', color: 'error' })
  }
}

async function handleToggle(c: AutoReplyCampaign) {
  try {
    await updateCampaign(c.id, { enabled: !c.enabled })
  } catch {
    toast.add({ title: String(error.value || 'Error'), color: 'error' })
  }
}

async function handleDelete(id: string) {
  try {
    await deleteCampaign(id)
  } catch {
    toast.add({ title: String(error.value || 'Error'), color: 'error' })
  }
}

async function handleOpenLogs(c: AutoReplyCampaign) {
  activeCampaign.value = c
  activeLogs.value = await fetchLogs(c.id, 25)
  const stats = await fetchStats(c.id)
  statsText.value = stats ? `${stats.sent} sent · ${stats.skipped} skipped · ${stats.failed} failed` : ''
  logsOpen.value = true
}

function handleOpenDetail(id: string) {
  router.push(`/app/auto-reply/${id}`)
}

function captionExcerpt(item: AutoReplyMediaItem) {
  const caption = (item.caption || '').trim()
  if (!caption) return item.id
  return caption.length > 90 ? `${caption.slice(0, 90)}…` : caption
}

function formatMediaDate(iso: string | undefined) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return ''
  }
}

async function handleOpenPicker() {
  if (!formAccount.value) return
  pickerOpen.value = true
  pickerLoading.value = true
  try {
    pickerItems.value = await fetchRecentMedia(formAccount.value, 10)
    pickerSelected.value = formPosts.value.split(',').map((s) => s.trim()).filter(Boolean)
  } finally {
    pickerLoading.value = false
  }
}

function handleTogglePick(id: string) {
  pickerSelected.value = pickerSelected.value.includes(id)
    ? pickerSelected.value.filter((picked) => picked !== id)
    : [...pickerSelected.value, id].slice(0, 20)
}

function handleConfirmPicker() {
  formPosts.value = pickerSelected.value.join(', ')
  pickerOpen.value = false
}

function handleClosePicker() {
  pickerOpen.value = false
}

async function handleTest(c: AutoReplyCampaign | null) {
  const kws = c ? c.keywords : formKeywords.value.split(',').map((s) => s.trim()).filter(Boolean)
  const mode = c ? c.matchMode : formMode.value
  const matched = await testMatch(c ? c.id : null, testText.value, kws, mode)
  testResult.value = matched
}

async function loadAccounts() {
  try {
    const list = await $fetch<Array<{ id: string; accountName: string; platform: string }>>('/api/v1/social-accounts')
    accounts.value = (list || []).filter((a) => a.platform === 'instagram')
    if (!formAccount.value && accounts.value[0]) {
      formAccount.value = accounts.value[0].id
    }
  } catch {
    accounts.value = []
  }
}

async function loadWebhookStatus() {
  webhookStatus.value = await fetchWebhookStatus()
}

async function handleSubscribe(accountId: string) {
  subscribingId.value = accountId
  try {
    const fields = await subscribeWebhooks(accountId)
    if (fields) {
      toast.add({ title: t('subscribed'), description: fields.join(', '), color: 'success' })
    } else {
      toast.add({ title: t('subscribe_failed'), description: error.value || '', color: 'error' })
    }
  } finally {
    subscribingId.value = null
  }
}

useHead({
  title: t('title'),
  meta: [{ name: 'description', content: t('description') }],
})

onMounted(async () => {
  await Promise.all([fetchCampaigns(), loadAccounts(), loadWebhookStatus()])
})
</script>

<template>
  <UContainer class="py-8 max-w-5xl">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
        <p class="text-muted-foreground">{{ t('description') }}</p>
      </div>
      <UButton icon="i-lucide-plus" color="primary" @click="handleOpenCreate">
        {{ t('new_campaign') }}
      </UButton>
    </div>

    <UAlert color="neutral" variant="soft" icon="i-lucide-info" class="mb-6" :description="t('honesty')" />

    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-webhook" class="w-4 h-4" />
          <p class="font-semibold">{{ t('webhook_title') }}</p>
          <UBadge :color="webhookStatus?.verifyTokenConfigured ? 'success' : 'warning'" variant="subtle" size="xs">
            {{ webhookStatus?.verifyTokenConfigured ? t('webhook_ready') : t('webhook_missing_token') }}
          </UBadge>
        </div>
      </template>
      <div class="space-y-3 text-sm">
        <p class="text-muted-foreground">{{ t('webhook_description') }}</p>
        <UFormField :label="t('webhook_callback')" name="callback">
          <UInput :model-value="webhookStatus?.callbackUrl || ''" readonly class="w-full font-mono text-xs" />
        </UFormField>
        <div v-if="accounts.length > 0" class="flex flex-wrap gap-2">
          <UButton
            v-for="a in accounts"
            :key="a.id"
            size="sm"
            variant="outline"
            :loading="subscribingId === a.id"
            @click="() => handleSubscribe(a.id)"
          >
            {{ t('subscribe_button') }} · {{ a.accountName }}
          </UButton>
        </div>
      </div>
    </UCard>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="campaigns.length === 0" class="rounded-lg bg-muted/50 p-12 text-center">
      <UIcon name="i-lucide-message-circle-heart" class="mx-auto h-12 w-12 text-muted-foreground" />
      <p class="mt-4 text-sm text-muted-foreground">{{ t('empty') }}</p>
      <UButton v-if="accounts.length === 0" to="/app/integrations" icon="i-lucide-plug" color="primary" class="mt-6">
        {{ t('connect') }}
      </UButton>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2">
      <UCard v-for="c in campaigns" :key="c.id">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <UButton variant="link" class="p-0 h-auto font-semibold truncate text-left" @click="() => handleOpenDetail(c.id)">{{ c.name }}</UButton>
            <USwitch :model-value="c.enabled" @update:model-value="() => handleToggle(c)" />
          </div>
        </template>
        <div class="space-y-2 text-sm">
          <p class="text-muted-foreground">{{ (c.keywords || []).join(', ') }} · {{ c.matchMode }}</p>
          <div class="flex flex-wrap gap-1">
            <UBadge v-if="c.storyDmEnabled" color="primary" variant="subtle" size="xs">{{ t('story_dm_badge') }}</UBadge>
            <UBadge v-if="c.followGate" color="warning" variant="subtle" size="xs">{{ t('follow_gate_badge') }}</UBadge>
          </div>
          <p v-if="c.links?.length" class="text-muted-foreground">
            {{ t('clicks') }}: {{ c.links.map((l) => `${l.label}: ${l.clicks}`).join(' · ') }}
          </p>
          <p class="text-xs" :class="c.enabled ? 'text-green-600' : 'text-muted-foreground'">
            {{ c.enabled ? t('enable') : t('disable') }}
          </p>
        </div>
        <template #footer>
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" color="primary" icon="i-heroicons-eye" @click="() => handleOpenDetail(c.id)">{{ t('view_details') }}</UButton>
            <UButton size="sm" variant="soft" @click="() => handleEdit(c)">{{ t('save') }}</UButton>
            <UButton size="sm" variant="ghost" @click="() => handleOpenLogs(c)">{{ t('logs') }}</UButton>
            <UButton size="sm" variant="ghost" color="error" @click="() => handleDelete(c.id)">{{ t('delete') }}</UButton>
          </div>
        </template>
      </UCard>
    </div>

    <UModal v-model:open="showForm" :title="t('new_campaign')">
      <template #body>
        <div class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <UBadge color="neutral" variant="soft">{{ t('presets') }}:</UBadge>
            <UButton v-for="(p, i) in presets" :key="p.name" size="xs" variant="ghost" @click="() => handleApplyPreset(i)">
              {{ p.name }}
            </UButton>
          </div>
          <UFormField :label="t('campaign_name')" name="name">
            <UInput v-model="formName" class="w-full" />
          </UFormField>
          <UFormField :label="t('account')" name="account">
            <USelectMenu v-model="formAccount" :items="accounts.map((a) => ({ label: a.accountName, value: a.id }))" label-key="label" value-key="value" :placeholder="t('select_account')" class="w-full" />
          </UFormField>
          <UFormField name="posts">
            <template #label>
              <span class="inline-flex items-center gap-1">
                {{ t('watched_posts') }}
                <UTooltip :text="t('watched_posts_hint')">
                  <UIcon name="i-lucide-circle-help" class="w-4 h-4 text-muted-foreground" />
                </UTooltip>
              </span>
            </template>
            <div class="flex gap-2">
              <UInput v-model="formPosts" class="flex-1" placeholder="1789..., 1790..." />
              <UButton variant="outline" :disabled="!formAccount" @click="handleOpenPicker">
                {{ t('select_posts') }}
              </UButton>
            </div>
          </UFormField>
          <div class="flex items-center justify-between">
            <span class="text-sm">{{ t('match_all') }}</span>
            <USwitch v-model="formMatchAll" />
          </div>
          <UFormField :label="t('keywords')" name="keywords">
            <UInput v-model="formKeywords" class="w-full" />
          </UFormField>
          <UFormField :label="t('match_mode')" name="mode">
            <USelectMenu v-model="formMode" :items="[{ label: t('whole'), value: 'whole' }, { label: t('partial'), value: 'partial' }]" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="t('dm_template')" name="dm">
            <UTextarea v-model="formDm" class="w-full" :rows="3" />
          </UFormField>
          <div class="grid grid-cols-2 gap-2">
            <UFormField :label="t('link1_label')" name="l1l"><UInput v-model="formLink1Label" class="w-full" /></UFormField>
            <UFormField :label="t('link1_target')" name="l1t"><UInput v-model="formLink1Target" class="w-full" placeholder="https://" /></UFormField>
            <UFormField :label="t('link2_label')" name="l2l"><UInput v-model="formLink2Label" class="w-full" /></UFormField>
            <UFormField :label="t('link2_target')" name="l2t"><UInput v-model="formLink2Target" class="w-full" placeholder="https://" /></UFormField>
          </div>
          <UFormField :label="t('public_reply')" name="pub"><UInput v-model="formPublicReply" class="w-full" /></UFormField>
          <div class="flex items-center justify-between">
            <span class="text-sm">{{ t('ai_mode') }}</span>
            <USwitch v-model="formAi" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">{{ t('story_dm') }}</span>
            <USwitch v-model="formStoryDm" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">{{ t('follow_gate') }}</span>
            <USwitch v-model="formFollowGate" />
          </div>
          <UFormField v-if="formFollowGate" :label="t('follow_prompt')" name="followPrompt">
            <UInput v-model="formFollowPrompt" class="w-full" />
          </UFormField>
          <p class="text-xs text-muted-foreground">{{ t('follow_gate_note') }}</p>
          <UFormField :label="t('test_box')" name="test">
            <div class="flex gap-2">
              <UInput v-model="testText" class="flex-1" :placeholder="t('test_placeholder')" />
              <UButton variant="outline" @click="() => handleTest(editing)">{{ t('test_button') }}</UButton>
            </div>
          </UFormField>
          <p v-if="testResult !== null" class="text-sm">{{ t('matched') }}: {{ testResult || t('no_match') }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="handleCloseForm">{{ t('cancel') }}</UButton>
          <UButton color="primary" :loading="loading" @click="handleSave">{{ editing ? t('save') : t('create') }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="pickerOpen" :title="t('picker_title')" :description="t('picker_description')" :ui="{ content: 'md:min-w-[720px]' }">
      <template #body>
        <div v-if="pickerLoading" class="flex justify-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        <div v-else-if="pickerItems.length === 0" class="text-sm text-muted-foreground text-center py-8">
          {{ t('no_media') }}
        </div>
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            v-for="item in pickerItems"
            :key="item.id"
            type="button"
            class="relative rounded-lg overflow-hidden border-2 text-left transition"
            :class="pickerSelected.includes(item.id) ? 'border-primary' : 'border-transparent hover:border-muted'"
            @click="() => handleTogglePick(item.id)"
          >
            <img v-if="item.imageUrl" :src="item.imageUrl" :alt="captionExcerpt(item)" class="aspect-square w-full object-cover" loading="lazy" />
            <div v-else class="aspect-square w-full flex items-center justify-center bg-muted">
              <UIcon name="i-lucide-image-off" class="h-8 w-8 text-muted-foreground" />
            </div>
            <div class="absolute top-1 right-1">
              <UBadge v-if="pickerSelected.includes(item.id)" color="primary" variant="solid" size="xs">✓</UBadge>
            </div>
            <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <p class="text-[11px] text-white line-clamp-2 leading-tight">{{ captionExcerpt(item) }}</p>
              <p v-if="formatMediaDate(item.timestamp)" class="text-[10px] text-white/70">{{ formatMediaDate(item.timestamp) }}</p>
            </div>
          </button>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="handleClosePicker">{{ t('cancel') }}</UButton>
          <UButton color="primary" :disabled="pickerSelected.length === 0" @click="handleConfirmPicker">
            {{ t('track_selected', { count: pickerSelected.length }) }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="logsOpen" :title="t('logs')">
      <template #body>
        <p v-if="statsText" class="text-sm text-muted-foreground mb-3">{{ statsText }}</p>
        <div v-if="activeLogs.length === 0" class="text-sm text-muted-foreground">{{ t('no_match') }}</div>
        <div v-else class="divide-y divide-default">
          <div v-for="l in activeLogs" :key="l.commentId + l.at" class="py-2 text-sm">
            <p class="font-medium">{{ l.authorName }} <span class="text-muted-foreground">· {{ l.action }} · {{ l.reason }}</span></p>
            <p class="text-xs text-muted-foreground">{{ l.at }}</p>
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
