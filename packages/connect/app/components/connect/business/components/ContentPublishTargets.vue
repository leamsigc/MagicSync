<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import type { ContentTargetOption } from '../../../../composables/useContentEditor'

/**
 * The publish target picker: the owner's own connections, already filtered to
 * the ones that can publish. The `config` JSON string is parsed for its repo or
 * site URL so the choice is readable, the same way `publish.vue` reads it.
 */

const props = defineProps<{
  targets: ContentTargetOption[]
  loading: boolean
}>()

const connectionId = defineModel<string>('connectionId', { default: '' })

const { t } = useI18n()

const items = computed(() => props.targets.map(target => ({
  value: target.id,
  label: target.detail ? `${target.name} — ${target.detail}` : target.name,
})))
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center gap-2">
    <span class="shrink-0 text-xs font-medium text-muted">{{ t('board.target.label') }}</span>
    <USelect
      v-if="items.length"
      v-model="connectionId"
      :items="items"
      :loading="loading"
      size="sm"
      class="min-w-0 flex-1"
      :placeholder="t('board.target.label')"
      :aria-label="t('board.target.label')"
      data-testid="publish-target"
    />
    <p v-else-if="!loading" class="min-w-0 flex-1 truncate text-xs text-muted" data-testid="publish-target-empty">
      {{ t('board.target.empty') }}
    </p>
  </div>
</template>