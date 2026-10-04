<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import ContentSocialPosts from './ContentSocialPosts.vue'
import { contentApiError } from '../../../../utils/content-api-error'
import type { ContentPlatformPost } from '../../../../composables/useContentEditor'

/**
 * Social posts on demand (PRD-CONTENT-PIPELINE-OVERHAUL §10 D08, §10.1.5).
 *
 * **Empty by default.** Nothing is drafted until the owner asks, because a draft
 * nobody asked for is noise. Two ways to ask: *Auto-generate* takes every
 * platform available, *Choose platforms* takes the ones that were ticked.
 *
 * The available list is the intersection of two real sources: the system catalog
 * (`GET /api/ai-tools/social-media/platforms`, the same endpoint the scan dialog
 * reads — so no platform is hardcoded here) and the accounts this business has
 * actually connected (`GET /api/v1/social-accounts?businessId=`). A platform the
 * owner cannot post to is not offered.
 *
 * **Posting is a different action from publishing the article.** It goes through
 * `content.social.publish`, per platform, and never shares the article's confirm
 * step: the article is released by the Publish control under the article, and
 * that is stated here rather than left to be inferred.
 */

interface CatalogPlatform {
  name: string
  display_name: string
}

interface ConnectedAccount {
  id: string
  platform: string
  accountName: string
  isActive?: boolean
}

interface GeneratedPost {
  platform: string
  text: string
  hashtags: string[]
}

interface CheckResult {
  result?: { posts?: GeneratedPost[] }
}

interface SocialChoice {
  name: string
  label: string
  accountId: string
}

interface SocialRoute {
  accountId: string
  text: string
  hashtags: string[]
}

type SendMode = 'now' | 'schedule'

const props = defineProps<{
  businessId: string
  itemId: string
  itemTitle: string
  /** The body the owner is looking at — the active platform version. */
  article: string
  /** The captions the write chain stored beside the article. */
  stored: ContentPlatformPost[]
  disabled?: boolean
}>()

const { t } = useI18n()
const toast = useToast()

const catalog = ref<CatalogPlatform[]>([])
const accounts = ref<ConnectedAccount[]>([])
const loadingChoices = ref(false)
const loaded = ref(false)
const pickerOpen = ref(false)
const chosen = ref<string[]>([])
const generating = ref(false)
const posts = ref<GeneratedPost[]>([])
const busy = ref<string[]>([])
const scheduleFor = ref<string | null>(null)
const scheduleAt = ref('')

/** Platform choices = the catalog ∩ a connected, live account (PRD §10 D08). */
const available = computed(() => catalog.value
  .map((entry) => {
    const account = accounts.value.find(row => row.platform === entry.name && row.isActive !== false)
    return account ? { name: entry.name, label: entry.display_name, accountId: account.id } : null
  })
  .filter((entry): entry is SocialChoice => entry !== null))

const canGenerate = computed(() => chosen.value.length > 0 && !generating.value && !props.disabled)
const hasPosts = computed(() => posts.value.length > 0)
const allBusy = computed(() => posts.value.length > 0 && posts.value.every(post => busy.value.includes(post.platform)))

function isBusy(platform: string): boolean {
  return busy.value.includes(platform)
}

function setBusy(platform: string, value: boolean) {
  busy.value = value ? [...busy.value, platform] : busy.value.filter(entry => entry !== platform)
}

function hashtagText(tag: string): string {
  return tag.startsWith('#') ? tag : `#${tag}`
}

async function loadChoices() {
  if (loaded.value) return
  loadingChoices.value = true
  try {
    const [platforms, connected] = await Promise.all([
      $fetch<CatalogPlatform[]>('/api/ai-tools/social-media/platforms'),
      $fetch<ConnectedAccount[]>('/api/v1/social-accounts', { query: { businessId: props.businessId } }),
    ])
    catalog.value = platforms
    accounts.value = connected
    loaded.value = true
  }
  catch (error) {
    log.error({ message: 'social choices failed to load', businessId: props.businessId, error: String(error) })
    toast.add({ title: t('rail.social.choicesFailed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    loadingChoices.value = false
  }
}

async function generate(targets: string[]) {
  if (generating.value || targets.length === 0) return
  if (!props.article.trim()) {
    toast.add({ title: t('rail.social.articleMissing'), icon: 'i-heroicons-light-bulb', color: 'warning' })
    return
  }
  generating.value = true
  try {
    const response = await $fetch<CheckResult>('/api/v1/content/check', {
      method: 'POST',
      body: {
        businessId: props.businessId,
        operation: 'social-post',
        content: props.article,
        topic: props.itemTitle,
        platforms: targets,
      },
    })
    posts.value = response.result?.posts ?? []
    toast.add({ title: t('rail.social.generated'), icon: 'i-heroicons-sparkles', color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('rail.social.generateFailed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    generating.value = false
  }
}

function handleAutoGenerate() {
  chosen.value = available.value.map(entry => entry.name)
  void generate(chosen.value)
}

function handleTogglePicker() {
  pickerOpen.value = !pickerOpen.value
}

function handleTogglePlatform(name: string) {
  chosen.value = chosen.value.includes(name)
    ? chosen.value.filter(entry => entry !== name)
    : [...chosen.value, name]
}

function handleGenerate() {
  void generate(chosen.value)
}

/** The generated post plus the account it would go out through, or `null`. */
function routeFor(platform: string): SocialRoute | null {
  const post = posts.value.find(entry => entry.platform === platform)
  const choice = available.value.find(entry => entry.name === platform)
  if (!post || !choice) return null
  return { accountId: choice.accountId, text: post.text, hashtags: post.hashtags }
}

function scheduleReady(mode: SendMode): boolean {
  return mode === 'now' || scheduleAt.value.length > 0
}

function sendBody(platform: string, mode: SendMode, route: SocialRoute): Record<string, unknown> {
  const body: Record<string, unknown> = {
    businessId: props.businessId,
    itemId: props.itemId,
    accountId: route.accountId,
    platform,
    text: route.text,
    hashtags: route.hashtags,
    mode,
  }
  if (mode === 'schedule') body.scheduleAt = scheduleAt.value
  return body
}

function notifySent(mode: SendMode, platform: string) {
  toast.add({
    title: t(mode === 'now' ? 'rail.social.posted' : 'rail.social.scheduled', { platform }),
    icon: mode === 'now' ? 'i-heroicons-paper-airplane' : 'i-heroicons-calendar-days',
    color: 'success',
  })
}

async function send(platform: string, mode: SendMode) {
  if (isBusy(platform)) return
  const route = routeFor(platform)
  if (!route) {
    toast.add({ title: t('rail.social.needsAccount', { platform }), icon: 'i-heroicons-exclamation-triangle', color: 'warning' })
    return
  }
  if (!scheduleReady(mode)) {
    toast.add({ title: t('rail.social.needsDate'), icon: 'i-heroicons-exclamation-triangle', color: 'warning' })
    return
  }
  setBusy(platform, true)
  try {
    await $fetch('/api/v1/content/social-publish', { method: 'POST', body: sendBody(platform, mode, route) })
    notifySent(mode, platform)
  }
  catch (error) {
    toast.add({
      title: t('rail.social.sendFailed', { platform }),
      description: contentApiError(error),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
  finally {
    setBusy(platform, false)
  }
}

async function handleSendAll() {
  if (allBusy.value) return
  await Promise.all(posts.value.map(post => send(post.platform, 'now')))
}

function handlePost(platform: string) {
  return send(platform, 'now')
}

function handleSchedule(platform: string) {
  return send(platform, 'schedule')
}

function handleToggleSchedule(platform: string) {
  scheduleFor.value = scheduleFor.value === platform ? null : platform
}

onMounted(() => {
  void loadChoices()
})
</script>

<template>
  <div class="space-y-3" data-testid="rail-social-body">
    <p class="text-[11px] text-muted" data-testid="rail-social-separate">
      {{ t('rail.social.separate') }}
    </p>

    <!-- Empty by default: two ways to ask for a draft. -->
    <div v-if="!hasPosts" v-motion-fade :duration="200" class="space-y-2" data-testid="social-empty">
      <p class="text-xs text-muted">
        {{ t('idea.social.empty') }}
      </p>
      <div class="flex flex-col gap-2">
        <UButton
          size="sm"
          block
          icon="i-heroicons-sparkles"
          :label="t('rail.social.auto')"
          :loading="generating"
          :disabled="!available.length || disabled"
          data-testid="social-auto"
          @click="handleAutoGenerate"
        />
        <UButton
          size="sm"
          block
          variant="outline"
          color="neutral"
          icon="i-heroicons-list-bullet"
          :label="t('rail.social.choose')"
          :loading="loadingChoices"
          :disabled="!available.length || disabled"
          data-testid="social-choose"
          @click="handleTogglePicker"
        />
      </div>
      <p v-if="!loadingChoices && !available.length" class="text-[11px] text-warning" data-testid="social-no-connected">
        {{ t('rail.social.noConnected') }}
      </p>
    </div>

    <div v-if="pickerOpen" v-motion-slide-bottom :duration="200" class="space-y-2 rounded-lg border border-default p-2" data-testid="social-picker">
      <UCheckbox
        v-for="entry in available"
        :key="entry.name"
        :model-value="chosen.includes(entry.name)"
        :label="entry.label"
        :data-testid="`social-platform-${entry.name}`"
        @update:model-value="() => handleTogglePlatform(entry.name)"
      />
      <UButton
        size="sm"
        block
        icon="i-heroicons-arrow-path"
        :label="t('rail.social.generate')"
        :loading="generating"
        :disabled="!canGenerate"
        data-testid="social-generate"
        @click="handleGenerate"
      />
    </div>

    <!-- Generated drafts. Posting here is not publishing the article. -->
    <div v-if="hasPosts" class="space-y-3">
      <div class="flex items-center gap-2">
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-heroicons-paper-airplane"
          :label="t('rail.social.postAll')"
          :loading="allBusy"
          data-testid="social-post-all"
          @click="handleSendAll"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-arrow-path"
          :label="t('rail.social.regenerate')"
          :loading="generating"
          data-testid="social-regenerate"
          @click="handleAutoGenerate"
        />
      </div>

      <article
        v-for="post in posts"
        :key="post.platform"
        class="space-y-2 rounded-lg border border-default p-2"
        :data-testid="`social-post-${post.platform}`"
      >
        <div class="flex items-center gap-2">
          <UBadge color="neutral" variant="outline" size="xs">{{ post.platform }}</UBadge>
        </div>
        <p class="whitespace-pre-wrap text-xs leading-relaxed text-highlighted">{{ post.text }}</p>
        <ul v-if="post.hashtags.length" class="flex flex-wrap gap-1" :data-testid="`social-hashtags-${post.platform}`">
          <li v-for="tag in post.hashtags" :key="tag">
            <UBadge color="neutral" variant="subtle" size="xs">{{ hashtagText(tag) }}</UBadge>
          </li>
        </ul>
        <div class="flex flex-wrap items-center gap-1.5">
          <UButton
            size="xs"
            icon="i-heroicons-paper-airplane"
            :label="t('rail.social.post')"
            :loading="isBusy(post.platform)"
            data-testid="social-post-now"
            @click="handlePost(post.platform)"
          />
          <UButton
            size="xs"
            variant="outline"
            color="neutral"
            icon="i-heroicons-calendar-days"
            :label="t('rail.social.schedule')"
            :disabled="isBusy(post.platform)"
            data-testid="social-schedule"
            @click="handleToggleSchedule(post.platform)"
          />
        </div>
        <div v-if="scheduleFor === post.platform" v-motion-slide-bottom :duration="200" class="space-y-2" :data-testid="`social-schedule-for-${post.platform}`">
          <UInput v-model="scheduleAt" size="xs" type="datetime-local" :aria-label="t('rail.social.scheduleAt')" data-testid="social-schedule-at" />
          <UButton
            size="xs"
            block
            icon="i-heroicons-calendar-days"
            :label="t('rail.social.scheduleConfirm')"
            :loading="isBusy(post.platform)"
            :disabled="!scheduleAt"
            data-testid="social-schedule-confirm"
            @click="handleSchedule(post.platform)"
          />
        </div>
      </article>
    </div>

    <!-- What the write chain already stored, per platform. -->
    <ContentSocialPosts
      v-if="stored.length"
      :posts="stored"
      :title="t('rail.social.stored')"
      class="border-t border-default pt-3"
    />
  </div>
</template>