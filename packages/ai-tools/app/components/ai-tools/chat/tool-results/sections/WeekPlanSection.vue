<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { effectiveCall, parseSectionPayload, type ToolCallLike } from '../../../../../composables/ai-tools/chat/runSections'

const props = defineProps<{
  calls: ToolCallLike[]
  businessId?: string | null
}>()

interface PlanAccount {
  id: string
  platform: string
  name: string
}

interface PlanTemplate {
  id: string
  title: string
  fields?: string[]
}

interface PlanPost {
  index: number
  scheduledAt: string
  caption: string
  platformVariants?: Record<string, string>
  image?: { assetId?: string, url?: string } | null
}

interface Plan {
  brief: string
  days: number
  template: PlanTemplate
  accounts: PlanAccount[]
  posts: PlanPost[]
}

interface PlanPayload {
  plan?: Plan
  requiresAccounts?: boolean
  requiresTemplate?: boolean
  brief?: string
  accounts?: PlanAccount[]
  templates?: PlanTemplate[]
  message?: string
}

type RevisePayload =
  | { kind: 'accounts', brief: string, accountIds: string[] }
  | { kind: 'template', brief: string, templateId: string, accountIds: string[] }
  | { kind: 'revise', brief: string, feedback: string, indexes: number[], accountIds: string[], templateId: string }

const emit = defineEmits<{
  revise: [payload: RevisePayload]
}>()

const { t } = useI18n()
const toast = useToast()

function payloadOf(call: ToolCallLike): PlanPayload {
  return (parseSectionPayload(effectiveCall(call).result) ?? {}) as PlanPayload
}

const payloads = computed(() => props.calls.map(payloadOf))
const active = computed(() => payloads.value.find(payload => payload.plan || payload.requiresAccounts || payload.requiresTemplate) ?? null)
const plan = computed(() => active.value?.plan ?? null)

const accountsSelection = ref<string[]>([])
const postsSelection = ref<number[]>([])
const approved = ref<number[]>([])
const feedback = ref('')
const busy = ref(false)

watch(active, (next) => {
  const nextPlan = next?.plan
  accountsSelection.value = nextPlan?.accounts.map(account => account.id) ?? next?.accounts?.map(account => account.id) ?? []
  postsSelection.value = nextPlan?.posts.map(post => post.index) ?? []
  approved.value = []
}, { immediate: true })

function toggleAccount(id: string, value: boolean | 'indeterminate'): void {
  const on = value === true
  accountsSelection.value = on
    ? [...new Set([...accountsSelection.value, id])]
    : accountsSelection.value.filter(entry => entry !== id)
}

function togglePost(index: number, value: boolean | 'indeterminate'): void {
  const on = value === true
  postsSelection.value = on
    ? [...new Set([...postsSelection.value, index])]
    : postsSelection.value.filter(entry => entry !== index)
}

function isAccountSelected(id: string): boolean {
  return accountsSelection.value.includes(id)
}

function isPostSelected(index: number): boolean {
  return postsSelection.value.includes(index)
}

function isApproved(index: number): boolean {
  return approved.value.includes(index)
}

function continueWithAccounts(): void {
  if (!active.value || accountsSelection.value.length === 0) {
    toast.add({ title: t('weekPlan.nothingSelected'), color: 'warning' })
    return
  }
  emit('revise', {
    kind: 'accounts',
    brief: active.value.brief ?? plan.value?.brief ?? '',
    accountIds: accountsSelection.value,
  })
}

function continueWithTemplate(templateId: string): void {
  if (!active.value) return
  emit('revise', {
    kind: 'template',
    brief: active.value.brief ?? '',
    templateId,
    accountIds: active.value.accounts?.map(account => account.id) ?? [],
  })
}

function variantsOf(post: PlanPost): Record<string, string> {
  return post.platformVariants ?? {}
}

function platformNames(post: PlanPost): string[] {
  return Object.keys(variantsOf(post))
}

function postBody(current: Plan, post: PlanPost): Record<string, unknown> {
  return {
    businessId: props.businessId,
    content: post.caption,
    targetPlatforms: current.accounts.map(account => account.id),
    mediaAssets: post.image?.assetId ? [post.image.assetId] : [],
    scheduledAt: post.scheduledAt,
    status: 'scheduled',
    platformContent: Object.fromEntries(
      Object.entries(variantsOf(post)).map(([platform, content]) => [platform, { content }]),
    ),
    postFormat: 'post',
    comment: [],
  }
}

async function approve(indexes: number[]): Promise<void> {
  const current = plan.value
  if (!current || !props.businessId) return
  const selected = current.posts.filter(post => indexes.includes(post.index))
  if (selected.length === 0) {
    toast.add({ title: t('weekPlan.nothingSelected'), color: 'warning' })
    return
  }
  busy.value = true
  try {
    const results = await Promise.allSettled(selected.map(post => $fetch('/api/v1/posts', {
      method: 'POST',
      body: postBody(current, post),
    })))
    const created = results.filter(result => result.status === 'fulfilled').length
    approved.value = [...new Set([...approved.value, ...selected.map(post => post.index)])]
    toast.add({
      title: created === selected.length
        ? t('weekPlan.approved', { count: created })
        : t('weekPlan.approvePartial', { created, total: selected.length }),
      icon: created === selected.length ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle',
      color: created === selected.length ? 'success' : 'warning',
    })
  }
  catch (error: unknown) {
    toast.add({
      title: t('weekPlan.approveFailed'),
      description: error instanceof Error ? error.message : undefined,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
  finally {
    busy.value = false
  }
}

function approveAll(): void {
  if (!plan.value) return
  void approve(plan.value.posts.map(post => post.index))
}

function approveSelected(): void {
  void approve(postsSelection.value)
}

function requestChanges(): void {
  const current = plan.value
  if (!current) return
  if (!feedback.value.trim()) {
    toast.add({ title: t('weekPlan.feedbackRequired'), color: 'warning' })
    return
  }
  emit('revise', {
    kind: 'revise',
    brief: current.brief,
    feedback: feedback.value.trim(),
    indexes: postsSelection.value,
    accountIds: current.accounts.map(account => account.id),
    templateId: current.template.id,
  })
  feedback.value = ''
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function platformLabel(platform: string): string {
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}
</script>

<template>
  <section
    v-motion-fade
    data-testid="run-section"
    data-kind="plan"
    :duration="200"
    class="space-y-3 overflow-hidden rounded-xl border border-default bg-default"
  >
    <div v-for="call in calls" :key="call.id">
      <div v-if="call.error" class="m-3 rounded-xl bg-error/10 p-3">
        <p class="text-sm whitespace-pre-wrap text-error/90">{{ call.error }}</p>
      </div>
    </div>

    <template v-if="active?.requiresAccounts">
      <header class="border-b border-default px-4 py-3">
        <p class="text-sm font-semibold text-highlighted">{{ t('weekPlan.accountsTitle') }}</p>
        <p class="mt-1 text-xs text-muted">{{ t('weekPlan.accountsHint') }}</p>
      </header>
      <div v-if="(active.accounts?.length ?? 0) === 0" class="p-4 text-sm text-muted">
        {{ t('weekPlan.noAccounts') }}
      </div>
      <div v-else class="space-y-3 p-3">
        <div class="grid gap-2 sm:grid-cols-2">
          <UCheckbox
            v-for="account in active.accounts"
            :key="account.id"
            :model-value="isAccountSelected(account.id)"
            :label="account.name"
            :description="platformLabel(account.platform)"
            @update:model-value="toggleAccount(account.id, $event)"
          />
        </div>
        <UButton color="primary" icon="i-heroicons-calendar-days" @click="continueWithAccounts">
          {{ t('weekPlan.continue') }}
        </UButton>
      </div>
    </template>

    <template v-else-if="active?.requiresTemplate">
      <header class="border-b border-default px-4 py-3">
        <p class="text-sm font-semibold text-highlighted">{{ t('weekPlan.templateTitle') }}</p>
        <p class="mt-1 text-xs text-muted">{{ active.message }}</p>
      </header>
      <div v-if="(active.templates?.length ?? 0) === 0" class="p-4 text-sm text-muted">
        {{ t('weekPlan.noTemplates') }}
      </div>
      <div v-else class="grid gap-2 p-3 sm:grid-cols-2">
        <button
          v-for="template in active.templates"
          :key="template.id"
          type="button"
          class="rounded-xl border border-default bg-elevated p-3 text-left transition-colors hover:border-primary/40"
          @click="continueWithTemplate(template.id)"
        >
          <p class="text-sm font-medium text-highlighted">{{ template.title }}</p>
          <p class="mt-1 text-xs text-muted">{{ template.id }}</p>
        </button>
      </div>
    </template>

    <template v-else-if="plan">
      <header class="flex flex-wrap items-center justify-between gap-2 border-b border-default px-4 py-3">
        <div>
          <p class="text-sm font-semibold text-highlighted">{{ t('weekPlan.title', { days: plan.days }) }}</p>
          <p class="mt-1 text-xs text-muted">{{ plan.template.title }} · {{ t('weekPlan.selectedAccounts', { count: plan.accounts.length }) }}</p>
        </div>
        <div class="flex items-center gap-2">
          <UButton size="sm" color="primary" icon="i-heroicons-check" :loading="busy" @click="approveAll">
            {{ t('weekPlan.approveAll', { count: plan.posts.length }) }}
          </UButton>
          <UButton size="sm" variant="outline" color="neutral" icon="i-heroicons-check-circle" :loading="busy"
            :disabled="postsSelection.length === 0" @click="approveSelected">
            {{ t('weekPlan.approveSelected', { count: postsSelection.length }) }}
          </UButton>
        </div>
      </header>

      <div class="space-y-3 p-3">
        <article
          v-for="post in plan.posts"
          :key="post.index"
          class="overflow-hidden rounded-xl border border-default bg-elevated"
        >
          <div class="flex items-center justify-between gap-2 border-b border-default px-3 py-2">
            <UCheckbox
              :model-value="isPostSelected(post.index)"
              :label="t('weekPlan.postLabel', { index: post.index + 1 })"
              @update:model-value="togglePost(post.index, $event)"
            />
            <div class="flex items-center gap-2">
              <UBadge v-if="isApproved(post.index)" color="success" variant="subtle" size="xs">
                {{ t('weekPlan.createdBadge') }}
              </UBadge>
              <span class="text-xs text-muted">{{ formatDate(post.scheduledAt) }}</span>
            </div>
          </div>
          <div class="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div class="min-w-0 space-y-2">
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="platform in platformNames(post)" :key="platform" color="neutral" variant="subtle" size="xs">
                  {{ platformLabel(platform) }}
                </UBadge>
              </div>
              <p class="whitespace-pre-wrap text-sm leading-relaxed text-highlighted">{{ post.caption }}</p>
            </div>
            <div class="flex min-h-28 items-center justify-center overflow-hidden rounded-lg border border-default bg-default">
              <img
                v-if="post.image?.url"
                :src="post.image.url"
                :alt="t('weekPlan.postLabel', { index: post.index + 1 })"
                class="max-h-48 w-full object-contain"
                loading="lazy"
              >
              <p v-else class="p-3 text-center text-xs text-muted">{{ t('weekPlan.imagePending') }}</p>
            </div>
          </div>
        </article>
      </div>

      <footer class="space-y-2 border-t border-default p-3">
        <UInput v-model="feedback" :placeholder="t('weekPlan.feedbackPlaceholder')" class="w-full" />
        <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-path" @click="requestChanges">
          {{ t('weekPlan.requestChanges') }}
        </UButton>
      </footer>
    </template>
  </section>
</template>
