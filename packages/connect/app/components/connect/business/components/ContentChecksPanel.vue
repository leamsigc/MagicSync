<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import { findingLines, type ContentCheckView } from '../../../../composables/useContentEditor'

/**
 * The stored SEO / GEO / link checks with their scores — and their `findings`,
 * which used to be dropped on the floor client-side. A finding key is data the
 * server chose, so it falls back to itself rather than needing four locales.
 *
 * `heading` is the host's: rendered only when given, so the rail's Checks section
 * does not print its own title twice.
 */

const props = defineProps<{ checks: ContentCheckView[], heading?: string }>()

const { t } = useI18n()

const STATUS_COLOR: Record<string, string> = { pass: 'success', warn: 'warning' }

const rows = computed(() => props.checks.map(check => ({
  ...check,
  color: STATUS_COLOR[check.status] ?? 'error',
  lines: findingLines(check.findings),
})))
</script>

<template>
  <section data-testid="checks-panel">
    <h2 v-if="props.heading" class="text-[11px] font-semibold uppercase tracking-wider text-muted">
      {{ props.heading }}
    </h2>
    <p v-if="rows.length === 0" class="mt-2 text-xs text-muted">
      {{ t('idea.checks.empty') }}
    </p>
    <ul v-else class="mt-2 space-y-3">
      <li v-for="check in rows" :key="check.id" :data-testid="`check-${check.kind}`">
        <div class="flex items-center gap-2 text-xs">
          <UBadge :color="check.color" variant="subtle" size="xs">{{ check.kind }}</UBadge>
          <span v-if="check.score !== null" class="tabular-nums text-muted" :data-testid="`check-score-${check.kind}`">
            {{ t('idea.checks.score', { score: check.score }) }}
          </span>
          <span class="ml-auto text-muted">{{ t(`idea.checks.status.${check.status}`, check.status) }}</span>
        </div>
        <ul v-if="check.lines.length" class="mt-1.5 space-y-0.5 border-l border-default pl-3">
          <li v-for="(line, index) in check.lines" :key="`${line.key}-${index}`" class="text-[11px] text-muted">
            <span class="font-medium text-muted/80">{{ t(`idea.checks.findings.${line.key}`, line.key) }}</span>
            <span v-if="line.detail" class="tabular-nums"> · {{ line.detail }}</span>
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>