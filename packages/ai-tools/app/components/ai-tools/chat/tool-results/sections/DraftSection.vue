<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { effectiveCall, parseSectionPayload, type ToolCallLike } from '../../../../../composables/ai-tools/chat/runSections'
import { type SocialAccount } from './draftPreview'
import DraftCard from './DraftCard.vue'

const props = defineProps<{
  calls: ToolCallLike[]
  businessId?: string | null
}>()

interface ComposePayload {
  content: string
  accounts: Array<{ id: string, platform: string }>
  platformVariants?: Record<string, string>
}

const emit = defineEmits<{
  compose: [payload: ComposePayload]
}>()

const { t } = useI18n()
const toast = useToast()
const accounts = ref<SocialAccount[]>([])
const creatingAll = ref(false)

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function draftOf(call: ToolCallLike): Record<string, unknown> {
  const payload = parseSectionPayload(effectiveCall(call).result) ?? {}
  return recordOf(payload.draft) ?? payload
}

/** A batch tool returns many drafts; render one card per draft. */
function asDraftCards(call: ToolCallLike): ToolCallLike[] {
  const payload = parseSectionPayload(effectiveCall(call).result)
  const drafts = payload?.drafts
  if (!Array.isArray(drafts)) return [call]
  return drafts.map((draft, index) => ({
    id: `${call.id}-${index}`,
    name: 'write_post',
    args: effectiveCall(call).args,
    result: JSON.stringify({ draft }),
  }))
}

const draftCards = computed(() => props.calls.flatMap(asDraftCards))

function requestedPlatforms(call: ToolCallLike): string[] {
  const args = effectiveCall(call).args
  const platforms = args.platforms
  if (Array.isArray(platforms)) return platforms.filter((platform): platform is string => typeof platform === 'string')
  const variants = recordOf(draftOf(call).platformVariants)
  return variants ? Object.keys(variants) : []
}

function targetAccounts(call: ToolCallLike): SocialAccount[] {
  const platforms = requestedPlatforms(call).map(platform => platform.toLowerCase())
  if (platforms.length === 0) return accounts.value.slice(0, 1)
  return accounts.value.filter(account => account.platform && platforms.includes(account.platform.toLowerCase()))
}

function captionOf(call: ToolCallLike): string {
  const caption = draftOf(call).caption
  return typeof caption === 'string' ? caption : ''
}

interface CreateTarget {
  caption: string
  accountIds: string[]
}

function createTargets(): CreateTarget[] {
  return draftCards.value.flatMap((call): CreateTarget[] => {
    const caption = captionOf(call)
    const accountIds = targetAccounts(call).map(account => account.id)
    return caption && accountIds.length > 0 ? [{ caption, accountIds }] : []
  })
}

function createOne(target: CreateTarget): Promise<unknown> {
  return $fetch('/api/v1/posts', {
    method: 'POST',
    body: {
      businessId: props.businessId,
      content: target.caption,
      targetPlatforms: target.accountIds,
      scheduledAt: new Date().toISOString(),
      status: 'scheduled',
    },
  })
}

async function handleCreateAll(): Promise<void> {
  const targets = createTargets()
  if (!props.businessId || targets.length === 0) {
    toast.add({ title: t('workflow.draft.noTargets'), icon: 'i-heroicons-x-circle', color: 'warning' })
    return
  }
  creatingAll.value = true
  try {
    const settled = await Promise.allSettled(targets.map(createOne))
    const created = settled.filter(result => result.status === 'fulfilled').length
    const title = created === targets.length
      ? t('workflow.draft.createdAll', { count: created })
      : t('workflow.draft.createdSome', { created, total: targets.length })
    toast.add({
      title,
      icon: created === targets.length ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle',
      color: created === targets.length ? 'success' : 'warning',
    })
  }
  finally {
    creatingAll.value = false
  }
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

function handleCompose(payload: ComposePayload): void {
  emit('compose', payload)
}

onMounted(() => {
  void loadAccounts()
})

watch(() => props.businessId, () => {
  void loadAccounts()
})
</script>

<template>
  <section
    v-motion-fade
    data-testid="run-section"
    data-kind="draft"
    :duration="200"
    class="space-y-2"
  >
    <div
      v-if="draftCards.length > 1"
      class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2"
    >
      <p class="text-xs text-muted">{{ t('workflow.draft.batchHint', { count: draftCards.length }) }}</p>
      <UButton
        size="sm"
        color="primary"
        icon="i-heroicons-rocket-launch"
        :loading="creatingAll"
        data-testid="draft-create-all"
        @click="handleCreateAll"
      >
        {{ t('workflow.draft.createAll', { count: draftCards.length }) }}
      </UButton>
    </div>

    <DraftCard
      v-for="(call, index) in draftCards"
      :key="call.id"
      :call="call"
      :accounts="accounts"
      :business-id="businessId"
      :index="index + 1"
      :total="draftCards.length"
      @compose="handleCompose"
    />
  </section>
</template>
