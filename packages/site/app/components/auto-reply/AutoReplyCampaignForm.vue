<i18n src="#site/app/components/auto-reply/campaign-form.json"></i18n>
<script lang="ts" setup>
/**
 * Create + edit form for an auto-reply campaign, shared by the list page and
 * the campaign detail page so both expose the *complete* set of settings.
 *
 * The post picker is a step inside this same dialog (`step = 'posts'`), not a
 * second UModal: two sibling dialog portals put the parent overlay on top of
 * the picker and made it unclickable.
 */
import type { AutoReplyCampaign, AutoReplyMediaItem } from '~/composables/useAutoReply'

const props = withDefaults(defineProps<{
  open: boolean
  campaign?: AutoReplyCampaign | null
}>(), { campaign: null })

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [campaign: AutoReplyCampaign]
}>()

const { t } = useI18n()
const toast = useToast()
const activeBusinessId = useState<string>('business:id')
const { error, createCampaign, updateCampaign, fetchPublishedPosts, generateTemplate, testMatch } = useAutoReply()

// Message content, not UI chrome: presets and the starter template are drafts
// the user edits, so they are not translated keys.
const DEFAULT_DM = 'Hey {username}! Here is your link: {link1}'

const presets = [
  { key: 'preset_link_magnet', keywords: 'LINK, INFO', dm: 'Hey {username}! Here is your link: {link1}', publicReply: 'Sent you a DM @{username}!' },
  { key: 'preset_discount', keywords: 'DISCOUNT, CODE', dm: 'Hey {username}! Your code is SAVE10 — shop here: {link1}', publicReply: 'Code sent to your DMs @{username}!' },
  { key: 'preset_webinar', keywords: 'WEBINAR, RSVP', dm: 'Hey {username}! Save your seat: {link1} (details: {link2})', publicReply: 'Invite sent @{username} — check DMs!' },
]

const step = ref<'form' | 'posts'>('form')
const saving = ref(false)
const generating = ref(false)
const accounts = ref<Array<{ id: string, accountName: string }>>([])
const accountsLoading = ref(false)
const pickerItems = ref<AutoReplyMediaItem[]>([])
const pickerSelected = ref<string[]>([])
const pickerLoading = ref(false)
const testText = ref('')
const testResult = ref<string | null>(null)
const testRan = ref(false)

const form = reactive({
  name: '',
  socialAccountId: '',
  postsText: '',
  matchAllPosts: false,
  keywords: 'LINK',
  matchMode: 'whole' as 'whole' | 'partial',
  dmTemplate: DEFAULT_DM,
  link1Label: '',
  link1Target: '',
  link2Label: '',
  link2Target: '',
  publicReplyTemplate: '',
  aiMode: false,
  storyDmEnabled: false,
  followGate: false,
  followPromptTemplate: '',
})

const isEditing = computed(() => !!props.campaign)
const title = computed(() => (isEditing.value ? t('edit_campaign') : t('new_campaign')))
const subtitle = computed(() => (isEditing.value ? t('subtitle_edit') : t('subtitle_new')))
const submitLabel = computed(() => (isEditing.value ? t('save') : t('create')))
const matchModeItems = computed(() => [
  { label: t('whole'), value: 'whole' },
  { label: t('partial'), value: 'partial' },
])
const accountItems = computed(() => accounts.value.map(account => ({ label: account.accountName, value: account.id })))

watch(() => props.open, (open) => {
  if (open) void initialise()
})

function splitList(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function isHttpsTarget(value: string): boolean {
  return /^https:\/\/\S+$/i.test(value.trim())
}

async function loadAccounts() {
  accountsLoading.value = true
  try {
    const list = await $fetch<Array<{ id: string, accountName: string, platform: string }>>('/api/v1/social-accounts')
    accounts.value = (list || []).filter(account => account.platform === 'instagram').map(account => ({ id: account.id, accountName: account.accountName }))
  } catch {
    accounts.value = []
    toast.add({ title: t('no_account'), color: 'error' })
  } finally {
    accountsLoading.value = false
  }
}

function resetForm() {
  form.name = ''
  form.socialAccountId = accounts.value[0]?.id || ''
  form.postsText = ''
  form.matchAllPosts = false
  form.keywords = 'LINK'
  form.matchMode = 'whole'
  form.dmTemplate = DEFAULT_DM
  form.link1Label = ''
  form.link1Target = ''
  form.link2Label = ''
  form.link2Target = ''
  form.publicReplyTemplate = ''
  form.aiMode = false
  form.storyDmEnabled = false
  form.followGate = false
  form.followPromptTemplate = ''
}

function applyCampaign(campaign: AutoReplyCampaign) {
  form.name = campaign.name
  form.socialAccountId = campaign.socialAccountId
  form.postsText = (campaign.externalPostIds || []).join(', ')
  form.matchAllPosts = !!campaign.matchAllPosts
  form.keywords = (campaign.keywords || []).join(', ')
  form.matchMode = campaign.matchMode || 'whole'
  form.dmTemplate = campaign.dmTemplate
  form.link1Label = campaign.links?.[0]?.label || ''
  form.link1Target = campaign.links?.[0]?.target || ''
  form.link2Label = campaign.links?.[1]?.label || ''
  form.link2Target = campaign.links?.[1]?.target || ''
  form.publicReplyTemplate = campaign.publicReplyTemplate || ''
  form.aiMode = campaign.mode === 'ai'
  form.storyDmEnabled = !!campaign.storyDmEnabled
  form.followGate = !!campaign.followGate
  form.followPromptTemplate = campaign.followPromptTemplate || ''
}

async function initialise() {
  step.value = 'form'
  testText.value = ''
  testResult.value = null
  testRan.value = false
  await loadAccounts()
  if (props.campaign) applyCampaign(props.campaign)
  else resetForm()
}

function handleClose() {
  emit('update:open', false)
}

function handleApplyPreset(index: number) {
  const preset = presets[index]
  if (!preset) return
  form.keywords = preset.keywords
  form.dmTemplate = preset.dm
  form.publicReplyTemplate = preset.publicReply
}

function buildLinks(): Array<{ label: string, target: string }> {
  const links: Array<{ label: string, target: string }> = []
  if (form.link1Target.trim()) {
    links.push({ label: form.link1Label.trim() || t('link1_label'), target: form.link1Target.trim() })
  }
  if (form.link2Target.trim()) {
    links.push({ label: form.link2Label.trim() || t('link2_label'), target: form.link2Target.trim() })
  }
  return links
}

function validateLinks(): string | null {
  for (const link of buildLinks()) {
    if (!isHttpsTarget(link.target)) return t('error_link', { label: link.label })
  }
  return null
}

function validateForm(): string | null {
  if (!form.name.trim()) return t('error_name')
  if (!form.socialAccountId) return t('error_account')
  if (splitList(form.keywords).length === 0) return t('error_keywords')
  if (!form.dmTemplate.trim()) return t('error_dm')
  return validateLinks()
}

function buildPayload() {
  return {
    name: form.name.trim(),
    socialAccountId: form.socialAccountId,
    externalPostIds: form.matchAllPosts ? [] : splitList(form.postsText).slice(0, 20),
    matchAllPosts: form.matchAllPosts,
    keywords: splitList(form.keywords).slice(0, 10),
    matchMode: form.matchMode,
    dmTemplate: form.dmTemplate,
    links: buildLinks(),
    publicReplyTemplate: form.publicReplyTemplate.trim() || undefined,
    storyDmEnabled: form.storyDmEnabled,
    followGate: form.followGate,
    followPromptTemplate: form.followPromptTemplate.trim() || undefined,
    enabled: props.campaign?.enabled ?? true,
    mode: form.aiMode ? 'ai' as const : 'template' as const,
  }
}

async function handleSubmit() {
  const invalid = validateForm()
  if (invalid) {
    toast.add({ title: invalid, color: 'error' })
    return
  }
  saving.value = true
  try {
    const payload = buildPayload()
    const saved = props.campaign
      ? await updateCampaign(props.campaign.id, payload)
      : await createCampaign(payload)
    toast.add({ title: t('saved_toast'), color: 'success' })
    emit('saved', saved)
    handleClose()
  } catch {
    toast.add({ title: error.value || t('save_error'), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function handleGenerateAi() {
  generating.value = true
  try {
    const text = await generateTemplate({
      keywords: splitList(form.keywords),
      dmTemplate: form.dmTemplate,
      publicReplyTemplate: form.publicReplyTemplate.trim() || undefined,
      links: buildLinks(),
      businessId: activeBusinessId.value || undefined,
    })
    if (!text) {
      toast.add({ title: t('ai_failed'), description: error.value || '', color: 'error' })
      return
    }
    form.dmTemplate = text
    toast.add({ title: t('ai_ready'), color: 'success' })
  } finally {
    generating.value = false
  }
}

async function handleOpenPosts() {
  if (!form.socialAccountId) {
    toast.add({ title: t('error_account'), color: 'error' })
    return
  }
  step.value = 'posts'
  pickerSelected.value = splitList(form.postsText)
  pickerItems.value = []
  pickerLoading.value = true
  error.value = null
  try {
    pickerItems.value = await fetchPublishedPosts(form.socialAccountId, 10)
    if (error.value) toast.add({ title: t('picker_failed'), description: error.value, color: 'error' })
  } finally {
    pickerLoading.value = false
  }
}

function handleTogglePick(id: string) {
  pickerSelected.value = pickerSelected.value.includes(id)
    ? pickerSelected.value.filter(picked => picked !== id)
    : [...pickerSelected.value, id].slice(0, 20)
}

function handleConfirmPosts() {
  form.postsText = pickerSelected.value.join(', ')
  step.value = 'form'
}

function handleBackToForm() {
  step.value = 'form'
}

async function handleTest() {
  const matched = await testMatch(props.campaign?.id ?? null, testText.value, splitList(form.keywords), form.matchMode)
  testResult.value = matched
  testRan.value = true
}

function captionExcerpt(item: AutoReplyMediaItem) {
  const caption = (item.caption || '').trim()
  if (!caption) return item.id
  return caption.length > 90 ? `${caption.slice(0, 90)}…` : caption
}

function formatMediaDate(iso: string | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString()
}
</script>

<template>
  <UModal
    :open="open"
    :title="step === 'posts' ? t('picker_title') : title"
    :description="step === 'posts' ? t('picker_description') : subtitle"
    :ui="{ content: 'sm:max-w-3xl' }"
    @update:open="value => emit('update:open', value)"
  >
    <template #body>
      <div v-if="step === 'form'" v-motion-fade :duration="150" class="space-y-6">
        <section v-if="!isEditing" class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('presets') }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="(preset, index) in presets"
              :key="preset.key"
              size="xs"
              variant="soft"
              color="neutral"
              @click="() => handleApplyPreset(index)"
            >
              {{ t(preset.key) }}
            </UButton>
          </div>
        </section>

        <section class="space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('section_basics') }}</h3>
          <UFormField :label="t('campaign_name')" name="name" required>
            <UInput v-model="form.name" class="w-full" :placeholder="t('campaign_name_placeholder')" />
          </UFormField>
          <UFormField :label="t('account')" name="account" required>
            <USelectMenu
              v-model="form.socialAccountId"
              :items="accountItems"
              label-key="label"
              value-key="value"
              :loading="accountsLoading"
              :placeholder="t('select_account')"
              class="w-full"
            />
            <template v-if="accounts.length === 0" #help>
              <span class="inline-flex flex-wrap items-center gap-2">
                {{ t('no_account') }}
                <UButton to="/app/integrations" size="xs" variant="link" class="p-0">{{ t('connect_accounts') }}</UButton>
              </span>
            </template>
          </UFormField>
        </section>

        <section class="space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('section_targeting') }}</h3>
          <UFormField :label="t('watched_posts')" name="posts" :help="t('watched_posts_hint')">
            <div class="flex flex-wrap gap-2">
              <UInput v-model="form.postsText" class="min-w-0 flex-1" :placeholder="t('posts_placeholder')" :disabled="form.matchAllPosts" />
              <UButton variant="outline" :disabled="!form.socialAccountId" @click="handleOpenPosts">
                {{ t('select_posts') }}
              </UButton>
            </div>
          </UFormField>
          <div class="rounded-xl border border-default p-3">
            <USwitch v-model="form.matchAllPosts" :label="t('match_all')" :description="t('match_all_hint')" color="primary" />
          </div>
        </section>

        <section class="space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('section_matching') }}</h3>
          <UFormField :label="t('keywords')" name="keywords" required :help="t('keywords_hint')">
            <UInput v-model="form.keywords" class="w-full" placeholder="LINK, INFO" />
          </UFormField>
          <UFormField :label="t('match_mode')" name="matchMode" :help="t('match_mode_hint')">
            <USelect v-model="form.matchMode" :items="matchModeItems" label-key="label" value-key="value" class="w-full" />
          </UFormField>
        </section>

        <section class="space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('section_message') }}</h3>
          <UFormField :label="t('dm_template')" name="dmTemplate" required>
            <div class="space-y-2">
              <UTextarea v-model="form.dmTemplate" class="w-full" :rows="3" />
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-xs text-muted">
                  {{ t('dm_template_hint') }}
                  <code class="rounded bg-muted px-1 py-0.5 text-[11px]">{username}</code>
                  <code class="rounded bg-muted px-1 py-0.5 text-[11px]">{link1}</code>
                  <code class="rounded bg-muted px-1 py-0.5 text-[11px]">{link2}</code>
                </p>
                <UButton size="xs" variant="soft" icon="i-lucide-sparkles" :loading="generating" @click="handleGenerateAi">
                  {{ generating ? t('ai_thinking') : t('ai_generate') }}
                </UButton>
              </div>
            </div>
          </UFormField>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField :label="t('link1_label')" name="link1Label">
              <UInput v-model="form.link1Label" class="w-full" />
            </UFormField>
            <UFormField :label="t('link1_target')" name="link1Target">
              <UInput v-model="form.link1Target" class="w-full" placeholder="https://" />
            </UFormField>
            <UFormField :label="t('link2_label')" name="link2Label">
              <UInput v-model="form.link2Label" class="w-full" />
            </UFormField>
            <UFormField :label="t('link2_target')" name="link2Target">
              <UInput v-model="form.link2Target" class="w-full" placeholder="https://" />
            </UFormField>
          </div>
          <p class="text-xs text-muted">{{ t('links_hint') }}</p>
          <UFormField :label="t('public_reply')" name="publicReply" :help="t('public_reply_hint')">
            <UInput v-model="form.publicReplyTemplate" class="w-full" placeholder="Sent you a DM!" />
          </UFormField>
        </section>

        <section class="space-y-3">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('section_behavior') }}</h3>
          <div class="rounded-xl border border-default p-3">
            <USwitch v-model="form.aiMode" :label="t('ai_mode')" :description="t('ai_mode_hint')" color="primary" />
          </div>
          <div class="rounded-xl border border-default p-3">
            <USwitch v-model="form.storyDmEnabled" :label="t('story_dm')" :description="t('story_dm_hint')" color="primary" />
          </div>
          <div class="rounded-xl border border-default p-3">
            <USwitch v-model="form.followGate" :label="t('follow_gate')" :description="t('follow_gate_hint')" color="primary" />
          </div>
          <UFormField v-if="form.followGate" v-motion-fade :duration="150" :label="t('follow_prompt')" name="followPrompt" :help="t('follow_prompt_hint')">
            <UInput v-model="form.followPromptTemplate" class="w-full" />
          </UFormField>
        </section>

        <section class="space-y-3">
          <UFormField :label="t('test_box')" name="test">
            <div class="flex flex-wrap gap-2">
              <UInput v-model="testText" class="min-w-0 flex-1" :placeholder="t('test_placeholder')" />
              <UButton variant="outline" @click="handleTest">{{ t('test_button') }}</UButton>
            </div>
          </UFormField>
          <p v-if="testRan" class="text-sm">
            <span class="text-muted">{{ t('matched') }}:</span>
            <UBadge :color="testResult ? 'success' : 'neutral'" variant="subtle" class="ms-1">
              {{ testResult || t('no_match') }}
            </UBadge>
          </p>
        </section>
      </div>

      <div v-else v-motion-fade :duration="150" class="min-h-48">
        <div v-if="pickerLoading" class="flex justify-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="size-8 animate-spin text-muted" />
        </div>
        <div v-else-if="pickerItems.length === 0" class="py-12 text-center text-sm text-muted">
          {{ t('picker_empty') }}
        </div>
        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            v-for="item in pickerItems"
            :key="item.id"
            type="button"
            class="relative overflow-hidden rounded-lg border-2 text-left transition"
            :class="pickerSelected.includes(item.id) ? 'border-primary' : 'border-transparent hover:border-muted'"
            @click="() => handleTogglePick(item.id)"
          >
            <img v-if="item.imageUrl" :src="item.imageUrl" :alt="captionExcerpt(item)" class="aspect-square w-full object-cover" loading="lazy">
            <div v-else class="flex aspect-square w-full items-center justify-center bg-muted">
              <UIcon name="i-lucide-image-off" class="size-8 text-muted" />
            </div>
            <UBadge v-if="pickerSelected.includes(item.id)" color="primary" variant="solid" size="xs" class="absolute right-1 top-1">✓</UBadge>
            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <p class="line-clamp-2 text-[11px] leading-tight text-white">{{ captionExcerpt(item) }}</p>
              <p class="text-[10px] text-white/70">{{ formatMediaDate(item.timestamp) }}</p>
            </div>
          </button>
        </div>
      </div>
    </template>

    <template #footer>
      <div v-if="step === 'form'" class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="handleClose">{{ t('cancel') }}</UButton>
        <UButton color="primary" :loading="saving" :disabled="generating" @click="handleSubmit">{{ submitLabel }}</UButton>
      </div>
      <div v-else class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="handleBackToForm">{{ t('picker_back') }}</UButton>
        <UButton color="primary" :disabled="pickerSelected.length === 0" @click="handleConfirmPosts">
          {{ t('track_selected', { count: pickerSelected.length }) }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
