<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import ContentChecksPanel from './ContentChecksPanel.vue'
import ContentRailActions from './ContentRailActions.vue'
import ContentRailSection from './ContentRailSection.vue'
import ContentRailSocial from './ContentRailSocial.vue'
import type { ContentCheckView, ContentPlatformPost } from '../../../../composables/useContentEditor'

/**
 * The idea view's right-hand rail (PRD-CONTENT-PIPELINE-OVERHAUL §10 D05).
 *
 * Checks, actions, social posts and shortcuts used to trail below the article,
 * which meant reaching them meant scrolling past everything you had already
 * read. Here they are four collapsible sections in a fixed-width rail that is
 * `sticky` from `xl` up: the article keeps the centred ~42rem reading measure of
 * §1.2 and never gets squeezed, and below `xl` the rail stacks under it rather
 * than crushing it.
 *
 * The rail owns no agent work of its own. Regenerate is the page's `write()`,
 * and every other action is its own endpoint, asked for by a press.
 */

const props = defineProps<{
  businessId: string
  itemId: string
  itemTitle: string
  /** The body the owner is looking at — the active platform version. */
  article: string
  checks: ContentCheckView[]
  stored: ContentPlatformPost[]
  writing: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  regenerate: []
  /** The article or its checks moved server-side, so the page reloads. */
  changed: []
}>()

const { t } = useI18n()

const open = reactive({ checks: true, actions: true, social: true, shortcuts: false })

const failing = computed(() => props.checks.filter(check => check.status !== 'pass').length)

/** Jump links to the meaningful parts of the page; a rail section opens too. */
const SHORTCUT_TARGETS = { article: 'idea-article', details: 'idea-details', checks: 'idea-checks', publish: 'idea-publish' }

const shortcuts = computed(() => Object.entries(SHORTCUT_TARGETS).map(([id, anchor]) => ({ id, anchor, label: t(`rail.shortcuts.${id}`) })))

/** A rail section is folded when a shortcut points at it, so it opens first. */
function handleShortcut(id: string, anchor: string) {
  if (id === 'checks') open.checks = true
  document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function handleRegenerate() {
  emit('regenerate')
}

function handleChanged() {
  emit('changed')
}
</script>

<template>
  <aside class="space-y-3" :aria-label="t('rail.label')" data-testid="idea-rail">
    <ContentRailSection
      v-model:open="open.checks"
      :title="t('idea.checks.title')"
      icon="i-heroicons-clipboard-document-check"
      testid="rail-checks"
      anchor="idea-checks"
      :badge="failing ? String(failing) : ''"
    >
      <ContentChecksPanel :checks="checks" />
    </ContentRailSection>

    <ContentRailSection
      v-model:open="open.actions"
      :title="t('rail.actions.title')"
      icon="i-heroicons-bolt"
      testid="rail-actions"
    >
      <ContentRailActions
        :business-id="businessId"
        :item-id="itemId"
        :item-title="itemTitle"
        :checks="checks"
        :writing="writing"
        @regenerate="handleRegenerate"
        @changed="handleChanged"
      />
    </ContentRailSection>

    <ContentRailSection
      v-model:open="open.social"
      :title="t('idea.social.title')"
      icon="i-heroicons-share"
      testid="rail-social"
    >
      <ContentRailSocial
        :business-id="businessId"
        :item-id="itemId"
        :item-title="itemTitle"
        :article="article"
        :stored="stored"
        :disabled="disabled"
      />
    </ContentRailSection>

    <ContentRailSection
      v-model:open="open.shortcuts"
      :title="t('rail.shortcuts.title')"
      icon="i-heroicons-link"
      testid="rail-shortcuts"
    >
      <nav class="space-y-1" data-testid="rail-shortcuts-list">
        <UButton
          v-for="entry in shortcuts"
          :key="entry.id"
          size="xs"
          variant="ghost"
          color="neutral"
          block
          icon="i-heroicons-arrow-down"
          :label="entry.label"
          :data-testid="`shortcut-${entry.id}`"
          :ui="{ base: 'justify-start gap-2' }"
          @click="handleShortcut(entry.id, entry.anchor)"
        />
      </nav>
    </ContentRailSection>
  </aside>
</template>