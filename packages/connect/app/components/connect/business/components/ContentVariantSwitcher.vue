<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import { ARTICLE_KEY, variantIntent, type ContentVariantView } from '../../../../composables/useContentEditor'

/**
 * The platform switcher (PRD-CONTENT-PIPELINE-OVERHAUL §10 D07).
 *
 * One content item, one body per platform, all in the artifact's `variants` map
 * beside `article`. The label says **why** a body reads the way it does: the
 * server grounded the WordPress and GitHub bodies in search and AI answers, and
 * the social bodies in the platform's own reaction — so a reader comparing two
 * versions can tell they were not sloppiness but different briefs.
 *
 * Switching only changes which body the page reads and edits; it never writes.
 * Saving a platform body goes through `content.update`, not the artifact route
 * (the artifact route would leave `variants` stale).
 */

interface VersionEntry {
  key: string
  title: string
  intent: 'search' | 'social' | 'shared'
  keywords: string[]
  notes: string
}

const props = defineProps<{
  variants: ContentVariantView[]
  active: string
  disabled?: boolean
}>()

const emit = defineEmits<{ select: [key: string] }>()

const { t } = useI18n()

/** The shared article is always the first version; variants follow in stored order. */
const entries = computed<VersionEntry[]>(() => [
  { key: ARTICLE_KEY, title: t('idea.variant.article'), intent: variantIntent(ARTICLE_KEY), keywords: [], notes: '' },
  ...props.variants.map(row => ({
    key: row.platform,
    title: row.platform,
    intent: variantIntent(row.platform),
    keywords: row.keywords,
    notes: row.notes,
  })),
])

const activeEntry = computed(() => entries.value.find(entry => entry.key === props.active) ?? entries.value[0] ?? null)

function intentLabel(entry: VersionEntry): string {
  return t(`idea.variant.intent.${entry.intent}`, entry.title)
}

function handleSelect(key: string) {
  emit('select', key)
}
</script>

<template>
  <div class="space-y-2" data-testid="variant-switcher">
    <div class="-mx-1 overflow-x-auto px-1 pb-1">
      <div class="flex w-max items-center gap-1.5">
        <UButton
          v-for="entry in entries"
          :key="entry.key"
          size="xs"
          :variant="entry.key === active ? 'solid' : 'outline'"
          :color="entry.key === active ? 'primary' : 'neutral'"
          :disabled="disabled"
          :data-testid="`variant-${entry.key}`"
          :aria-current="entry.key === active ? 'true' : undefined"
          @click="handleSelect(entry.key)"
        >
          <span class="flex flex-col items-start gap-0.5">
            <span>{{ entry.title }}</span>
            <span class="text-[10px] font-normal opacity-80">{{ intentLabel(entry) }}</span>
          </span>
        </UButton>
      </div>
    </div>

    <p v-if="activeEntry" v-motion-fade :duration="200" class="text-[11px] text-muted" data-testid="variant-intent">
      {{ intentLabel(activeEntry) }}
      <span v-if="activeEntry.notes" class="block">{{ activeEntry.notes }}</span>
      <span v-if="activeEntry.keywords.length" class="mt-1 flex flex-wrap gap-1" data-testid="variant-keywords">
        <UBadge v-for="tag in activeEntry.keywords" :key="tag" color="neutral" variant="subtle" size="xs">
          {{ t('idea.variant.keyword', { keyword: tag }) }}
        </UBadge>
      </span>
    </p>
  </div>
</template>