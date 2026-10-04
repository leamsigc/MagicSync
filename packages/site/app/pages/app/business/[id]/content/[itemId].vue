<i18n src="../content.json"></i18n>
<script setup lang="ts">
import ContentArticleEditor from '#layers/BaseConnect/app/components/connect/business/components/ContentArticleEditor.vue'
import ContentArticlePreview from '#layers/BaseConnect/app/components/connect/business/components/ContentArticlePreview.vue'
import ContentIdeaRail from '#layers/BaseConnect/app/components/connect/business/components/ContentIdeaRail.vue'
import ContentPublishTargets from '#layers/BaseConnect/app/components/connect/business/components/ContentPublishTargets.vue'
import ContentImagePickerModal from '#layers/BaseConnect/app/components/connect/business/components/ContentImagePickerModal.vue'
import ContentVariantSwitcher from '#layers/BaseConnect/app/components/connect/business/components/ContentVariantSwitcher.vue'
import { displayAngle } from '#layers/BaseConnect/app/utils/content-brief'
import { contentApiError } from '#layers/BaseConnect/app/utils/content-api-error'
import {
  ARTICLE_KEY,
  countWords,
  useContentEditor,
  variantIntent,
} from '#layers/BaseConnect/app/composables/useContentEditor'

/**
 * The idea view (PRD-CONTENT-PIPELINE-OVERHAUL §1.2, and §10 D04–D09).
 *
 * **One article, one body per platform** (D07). The artifact carries
 * `variants` beside `article`; the switcher says which body is on screen, which
 * one the server grounded for search and which for a platform's reaction, and
 * Save sends the edit to the endpoint that owns that half of the contract.
 *
 * **The title and brief are editable here** (D04), because the brief is what the
 * agent grounds its writing in — a first-class control, not a footnote. It is
 * seeded through `displayAngle`, the same sanitiser the board renders cards
 * with, so an envelope stored by an older run reads as the prose it wraps.
 *
 * **Checks, actions, social posts and shortcuts live in a right-hand rail**
 * (D05) instead of trailing under the article: the article keeps the centred
 * ~42rem reading measure and the rail stays reachable beside it.
 */

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()

const businessId = route.params.id as string
const itemId = route.params.itemId as string

const {
  article,
  artifact,
  canPublish,
  checks,
  isReleased,
  item,
  loading,
  moving,
  outcome,
  publish,
  publishing,
  safeMode,
  socialPosts,
  targetId,
  targets,
  targetsLoading,
  targetUrl,
  unpublish,
  variants,
  write,
  writing,
  editedOutput,
  load,
  loadSafeMode,
  loadTargets,
} = useContentEditor({ businessId, itemId })

const saving = ref(false)
const savingDetails = ref(false)
const confirming = ref(false)
const editing = ref(route.query.edit === '1')
const metaOpen = ref(false)
const pickerOpen = ref(false)
const activeKey = ref(ARTICLE_KEY)
/** Unsaved bodies, keyed by version — one per platform version of this item. */
const drafts = ref<Record<string, string>>({})
const details = reactive({ title: '', brief: '' })
const editorRef = ref<{ insertImage: (src: string, alt: string) => void } | null>(null)
/** The editor echoes its markdown back when the model is replaced from here. */
const syncing = ref(false)

useSeoMeta({
  title: () => item.value?.title || t('title'),
  description: () => t('seo_description'),
})

const STATE_DOT: Record<string, string> = {
  idea: 'bg-muted-400',
  failed: 'bg-error',
  drafting: 'bg-warning',
  review_required: 'bg-info',
  scheduled: 'bg-success',
  published: 'bg-success',
  archived: 'bg-muted-400',
}

const stateLabel = computed(() => t(`idea.state.${item.value?.state ?? ''}`, item.value?.state ?? ''))

const version = computed(() => artifact.value?.version ?? 0)

const itemDate = computed(() => new Date(item.value?.updatedAt ?? item.value?.createdAt ?? Date.now()).toLocaleDateString())

const platforms = computed(() => item.value?.platforms ?? [])

const needsWrite = computed(() => !article.value.trim())

/** The brief as prose — a JSON envelope is unwrapped, never rendered raw. */
const briefText = computed(() => displayAngle(item.value?.brief))

const detailSeed = computed(() => ({ title: item.value?.title ?? '', brief: briefText.value }))

const detailsDirty = computed(() => details.title.trim() !== detailSeed.value.title || details.brief.trim() !== detailSeed.value.brief)

const activeVariant = computed(() => variants.value.find(row => row.platform === activeKey.value) ?? null)

/** The body as the server last stored it, for whichever version is on screen. */
const storedBody = computed(() => (activeKey.value === ARTICLE_KEY ? article.value : activeVariant.value?.body ?? ''))

const body = computed({
  get: () => drafts.value[activeKey.value] ?? storedBody.value,
  set: (value: string) => {
    if (syncing.value) return
    drafts.value[activeKey.value] = value
  },
})

const dirty = computed(() => body.value !== storedBody.value)

const words = computed(() => countWords(body.value))

const intentLabel = computed(() => t(`idea.variant.intent.${variantIntent(outcome.value?.variant ?? '')}`))

/** Seed the header fields through the shared sanitiser, and re-seed on a reload. */
watch(detailSeed, (seed) => {
  details.title = seed.title
  details.brief = seed.brief
}, { immediate: true })

/** A reload that replaced the stored bodies retires the unsaved drafts with them. */
watch(artifact, () => {
  drafts.value = {}
})

/**
 * Run a change we initiated with the editor's echo muted, so replacing the model
 * from here is never mistaken for the owner typing.
 */
async function quietly(run: () => Promise<unknown>) {
  syncing.value = true
  try {
    await run()
  }
  finally {
    await nextTick()
    syncing.value = false
  }
}

async function handleReload() {
  await quietly(load)
}

function handleBack() {
  router.push(`/app/business/${businessId}/content`)
}

function handleToggleEdit() {
  editing.value = !editing.value
}

function handlePreview() {
  editing.value = false
}

function handleToggleMeta() {
  metaOpen.value = !metaOpen.value
}

/** Only the field the owner actually changed leaves the browser (D04). */
function detailsBody(): Record<string, unknown> {
  const seed = detailSeed.value
  const payload: Record<string, unknown> = { businessId, itemId }
  const title = details.title.trim()
  if (title && title !== seed.title) payload.title = title
  if (details.brief.trim() !== seed.brief) payload.brief = details.brief.trim()
  return payload
}

async function handleSaveDetails() {
  if (savingDetails.value || !detailsDirty.value) return
  savingDetails.value = true
  try {
    await quietly(async () => {
      await $fetch('/api/v1/content/update', { method: 'POST', body: detailsBody() })
      await load()
    })
    toast.add({ title: t('idea.details.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('idea.details.saveFailed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    savingDetails.value = false
  }
}

/**
 * The one save control, and which endpoint it uses is the version's business
 * (D07): `PUT /api/v1/artifacts/:id/edit` owns `output.article`, while a
 * platform body goes through `content.update` — that route rewrites the whole
 * output and would leave the rest of `variants` stale.
 */
async function persistBody(key: string, text: string) {
  if (key === ARTICLE_KEY) {
    await $fetch(`/api/v1/artifacts/${artifact.value?.id}/edit`, {
      method: 'PUT',
      query: { businessId },
      body: { version: artifact.value?.version, output: editedOutput(text) },
    })
    return
  }
  await $fetch('/api/v1/content/update', {
    method: 'POST',
    body: { businessId, itemId, variant: { platform: key, body: text } },
  })
}

async function handleSave() {
  if (saving.value || !artifact.value) return
  const key = activeKey.value
  const text = body.value
  saving.value = true
  try {
    await quietly(async () => {
      await persistBody(key, text)
      await load()
    })
    toast.add({ title: t('draft.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('draft.saveFailed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    saving.value = false
  }
}

function handleSelectVariant(key: string) {
  activeKey.value = key
}

function handleOpenPicker() {
  pickerOpen.value = true
}

/** At the caret when the editor is on screen; appended when it is not (D09). */
function handleInsertImage(url: string) {
  const alt = item.value?.title ?? ''
  if (editorRef.value) editorRef.value.insertImage(url, alt)
  else body.value = `${body.value.trimEnd()}\n\n![${alt}](${url})\n`
  pickerOpen.value = false
  toast.add({ title: t('assets.inserted'), icon: 'i-heroicons-photo', color: 'success' })
}

function handleWrite() {
  return quietly(write)
}

/**
 * Safe Mode is the server's `confirm` flag: ON, the first press only arms the
 * control; OFF, this press is the release. Either way the click is a human act
 * and the request that follows carries `confirm: true`.
 */
async function handlePublish() {
  if (publishing.value) return
  if (safeMode.value && !confirming.value) {
    confirming.value = true
    return
  }
  confirming.value = false
  await quietly(publish)
}

function handleCancelPublish() {
  confirming.value = false
}

function handleUnpublish() {
  confirming.value = false
  return quietly(unpublish)
}

onMounted(() => {
  void load()
  void loadSafeMode()
  void loadTargets()
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-default text-highlighted">
    <header class="sticky top-0 z-40 border-b border-default bg-default/95 backdrop-blur-xl">
      <div class="mx-auto flex w-full max-w-[72rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 lg:px-8">
        <UButton variant="ghost" color="neutral" icon="i-heroicons-arrow-left" :aria-label="t('back')" data-testid="idea-back" @click="handleBack" />
        <span class="flex items-center gap-2 text-xs text-muted" data-testid="idea-state">
          <span class="size-2 rounded-full" :class="STATE_DOT[item?.state ?? ''] ?? 'bg-muted-400'" aria-hidden />
          {{ stateLabel }}
        </span>
        <time class="text-xs text-muted">{{ itemDate }}</time>

        <div class="ml-auto flex items-center gap-1.5">
          <UButton
            size="sm"
            variant="ghost"
            :color="metaOpen ? 'primary' : 'neutral'"
            icon="i-heroicons-information-circle"
            :label="t('idea.meta')"
            data-testid="idea-meta"
            @click="handleToggleMeta"
          />
          <UButton
            v-if="editing"
            size="sm"
            icon="i-heroicons-check"
            :loading="saving"
            :disabled="!dirty"
            :label="t('idea.save')"
            data-testid="idea-save"
            @click="handleSave"
          />
          <UButton
            v-else
            size="sm"
            variant="outline"
            color="neutral"
            icon="i-heroicons-pencil-square"
            :label="t('idea.edit')"
            data-testid="idea-edit"
            @click="handleToggleEdit"
          />
          <UButton
            v-if="isReleased"
            size="sm"
            variant="outline"
            color="neutral"
            icon="i-heroicons-arrow-uturn-left"
            :loading="moving"
            :label="t('idea.unpublish')"
            data-testid="idea-unpublish"
            @click="handleUnpublish"
          />
          <UButton
            v-if="isReleased && targetUrl"
            size="sm"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-arrow-top-right-on-square"
            :label="t('idea.viewSite')"
            :to="targetUrl"
            external
            data-testid="idea-view-site"
          />
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-[72rem] flex-1 px-4 py-8 lg:px-8">
      <div v-if="loading && !item" class="flex justify-center py-20" data-testid="idea-loading">
        <UIcon name="i-heroicons-arrow-path" class="size-6 animate-spin text-muted" />
      </div>

      <UCard v-else-if="!item" v-motion-fade :duration="200" class="border border-default bg-elevated">
        <p class="text-sm text-muted">
          {{ t('feedback.detailFailed') }}
        </p>
        <UButton class="mt-4" variant="outline" color="neutral" icon="i-heroicons-arrow-left" :label="t('back')" @click="handleBack" />
      </UCard>

      <!-- The article keeps the §1.2 reading measure; the rail stacks below xl. -->
      <div v-else class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]" data-testid="idea-layout">
        <div class="min-w-0">
          <div id="idea-details" class="mx-auto w-full max-w-[42rem] scroll-mt-24">
            <!-- D04: the title and brief the agent writes from, editable here. -->
            <template v-if="editing">
              <UInput v-model="details.title" size="lg" class="w-full font-bold" :aria-label="t('card.titleField')" data-testid="idea-title-input" />
              <UTextarea
                v-model="details.brief"
                :rows="3"
                class="mt-3 w-full"
                :placeholder="t('card.briefPlaceholder')"
                :aria-label="t('card.briefField')"
                data-testid="idea-brief-input"
              />
              <div class="mt-2 flex items-center gap-2">
                <UButton
                  size="xs"
                  icon="i-heroicons-check"
                  :label="t('idea.details.save')"
                  :loading="savingDetails"
                  :disabled="!detailsDirty"
                  data-testid="idea-details-save"
                  @click="handleSaveDetails"
                />
                <span class="text-[11px] text-muted">{{ t('idea.details.hint') }}</span>
              </div>
            </template>
            <template v-else>
              <h1 class="text-3xl font-bold leading-tight tracking-tight text-highlighted lg:text-4xl" data-testid="idea-title">
                {{ item.title }}
              </h1>
              <p v-if="briefText" class="mt-3 text-lg leading-relaxed text-muted" data-testid="idea-brief">
                {{ briefText }}
              </p>
            </template>
          </div>

          <div v-if="metaOpen" v-motion-slide-bottom :duration="250" class="mx-auto mt-5 w-full max-w-[42rem] rounded-xl border border-default bg-elevated p-4 text-xs" data-testid="idea-meta-panel">
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt class="text-muted">
                {{ t('idea.metaFields.platforms') }}
              </dt>
              <dd class="text-highlighted">
                {{ platforms.length ? platforms.join(', ') : '—' }}
              </dd>
              <dt class="text-muted">
                {{ t('idea.metaFields.priority') }}
              </dt>
              <dd class="tabular-nums text-highlighted">
                {{ item.priority ?? 0 }}
              </dd>
              <dt class="text-muted">
                {{ t('idea.metaFields.updated') }}
              </dt>
              <dd class="text-highlighted">
                {{ itemDate }}
              </dd>
              <template v-if="item.postId">
                <dt class="text-muted">
                  {{ t('idea.metaFields.post') }}
                </dt>
                <dd class="truncate font-mono text-highlighted">
                  {{ item.postId }}
                </dd>
              </template>
            </dl>
          </div>

          <!-- D07: which body is on screen, and why it reads the way it does. -->
          <div v-if="variants.length" class="mx-auto mt-6 w-full max-w-[42rem]" data-testid="idea-variants">
            <ContentVariantSwitcher :variants="variants" :active="activeKey" :disabled="saving || writing" @select="handleSelectVariant" />
          </div>

          <div id="idea-article" class="mx-auto mt-8 w-full max-w-[42rem] scroll-mt-24">
            <div v-if="editing" v-motion-fade :duration="200" data-testid="idea-editor-wrap">
              <ContentArticleEditor :key="activeKey" ref="editorRef" v-model="body" :disabled="saving || writing" />
              <div class="mt-3 flex justify-end">
                <UButton
                  size="xs"
                  variant="outline"
                  color="neutral"
                  icon="i-heroicons-photo"
                  :label="t('assets.open')"
                  :disabled="saving"
                  data-testid="idea-insert-image"
                  @click="handleOpenPicker"
                />
              </div>
            </div>
            <div v-else>
              <ContentArticlePreview :markdown="body" />
            </div>
          </div>

          <!-- Article release. The social posts in the rail are a different action. -->
          <div id="idea-publish" class="mx-auto mt-12 flex w-full max-w-[42rem] scroll-mt-24 flex-wrap items-center gap-3 rounded-xl border border-default bg-elevated px-3 py-2.5">
            <ContentPublishTargets v-model:connection-id="targetId" :targets="targets" :loading="targetsLoading" />
            <div class="flex items-center gap-2">
              <UButton
                size="sm"
                :icon="confirming ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-paper-airplane'"
                :color="confirming ? 'warning' : 'primary'"
                :loading="publishing"
                :disabled="!canPublish"
                data-testid="idea-publish"
                @click="handlePublish"
              >
                {{ confirming ? t('publish.confirm') : t('publish.cta') }}
              </UButton>
              <UButton v-if="confirming" size="sm" variant="ghost" color="neutral" :label="t('publish.cancel')" @click="handleCancelPublish" />
            </div>
            <UButton
              v-if="needsWrite"
              size="sm"
              variant="ghost"
              color="neutral"
              icon="i-heroicons-pencil"
              :loading="writing"
              :label="t('board.writeNow')"
              data-testid="idea-write"
              @click="handleWrite"
            />
          </div>
          <p v-if="!isReleased && !canPublish && !needsWrite" class="mx-auto mt-2 w-full max-w-[42rem] text-xs text-muted" data-testid="idea-publish-blocked">
            {{ t('publish.blocked') }}
          </p>

          <div v-if="isReleased && outcome" v-motion-fade-visible :duration="250" class="mx-auto mt-8 w-full max-w-[42rem] rounded-xl border border-success/40 bg-success/5 p-4 text-xs" data-testid="idea-publish-outcome">
            <p class="text-sm font-semibold text-highlighted">
              {{ t('publish.done') }}
            </p>
            <dl class="mt-2 space-y-1 text-muted">
              <div class="flex gap-2">
                <dt>{{ t('idea.metaFields.post') }}:</dt>
                <dd class="truncate font-mono">{{ outcome.postId }}</dd>
              </div>
              <div class="flex gap-2">
                <dt>{{ t('publish.job') }}:</dt>
                <dd class="truncate font-mono">{{ outcome.jobId }}</dd>
              </div>
              <div class="flex gap-2" data-testid="idea-publish-variant">
                <dt>{{ t('publish.variantRow') }}:</dt>
                <dd>{{ intentLabel }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <ContentIdeaRail
          class="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto"
          :business-id="businessId"
          :item-id="itemId"
          :item-title="item.title"
          :article="body"
          :checks="checks"
          :stored="socialPosts"
          :writing="writing"
          :disabled="!body.trim()"
          @regenerate="handleWrite"
          @changed="handleReload"
        />
      </div>
    </main>

    <footer class="sticky bottom-0 z-30 border-t border-default bg-default/95 backdrop-blur-xl">
      <div class="mx-auto flex w-full max-w-[72rem] items-center gap-3 px-4 py-2.5 lg:px-8">
        <UButton
          v-if="editing"
          size="sm"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-eye"
          :label="t('idea.preview')"
          data-testid="idea-preview"
          @click="handlePreview"
        />
        <span v-else class="text-xs text-muted" data-testid="idea-status">{{ t('idea.preview') }}</span>
        <span class="ml-auto text-xs tabular-nums text-muted" data-testid="idea-words">
          {{ t('idea.words', { count: words }) }}
        </span>
        <span class="text-xs tabular-nums text-muted" data-testid="idea-version">
          {{ t('idea.version', { version }) }}
        </span>
      </div>
    </footer>

    <ContentImagePickerModal v-model:open="pickerOpen" :business-id="businessId" @select="handleInsertImage" />
  </div>
</template>