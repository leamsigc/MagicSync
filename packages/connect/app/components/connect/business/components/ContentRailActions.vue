<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import { contentApiError } from '../../../../utils/content-api-error'
import type { ContentCheckView } from '../../../../composables/useContentEditor'

/**
 * The Actions section of the rail (PRD-CONTENT-PIPELINE-OVERHAUL §10 D06).
 *
 * **Nothing here runs on its own.** `content.fix` repairs only the checks whose
 * status is not `pass`, so it is a control the owner presses, never a step that
 * follows a write. On a passing check set the server answers `changed: false` and
 * leaves the article alone, and that answer is reported as its own outcome
 * rather than dressed up as a repair.
 *
 * Regenerate is the whole write chain again, so it is the same call the board
 * makes; the page owns it and this section only asks.
 */

const props = defineProps<{
  businessId: string
  itemId: string
  itemTitle: string
  checks: ContentCheckView[]
  writing: boolean
}>()

const emit = defineEmits<{
  regenerate: []
  /** The article or the checks moved, so the page reloads the item. */
  changed: []
}>()

interface FixResult {
  changed: boolean
}

const { t } = useI18n()
const toast = useToast()

const keyword = ref('')
const fixing = ref(false)

const failing = computed(() => props.checks.filter(check => check.status !== 'pass').length)

function fixBody(): Record<string, unknown> {
  const body: Record<string, unknown> = { businessId: props.businessId, itemId: props.itemId, topic: props.itemTitle }
  if (keyword.value.trim()) body.keyword = keyword.value.trim()
  return body
}

function notifyFix(changed: boolean) {
  toast.add({
    title: t(changed ? 'rail.actions.fixed' : 'rail.actions.noChanges'),
    icon: changed ? 'i-heroicons-wrench-screwdriver' : 'i-heroicons-information-circle',
    color: changed ? 'success' : 'info',
  })
}

async function handleFix() {
  if (fixing.value) return
  fixing.value = true
  try {
    const result = await $fetch<FixResult>('/api/v1/content/fix', { method: 'POST', body: fixBody() })
    notifyFix(Boolean(result.changed))
    emit('changed')
  }
  catch (error) {
    toast.add({ title: t('rail.actions.failed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    fixing.value = false
  }
}

function handleRegenerate() {
  emit('regenerate')
}
</script>

<template>
  <div class="space-y-3" data-testid="rail-actions-body">
    <div>
      <p class="text-xs font-medium text-highlighted" data-testid="rail-actions-failing">
        {{ t('rail.actions.failing', { count: failing }) }}
      </p>
      <p class="mt-0.5 text-[11px] text-muted">
        {{ t('rail.actions.note') }}
      </p>
    </div>

    <UFormField :label="t('rail.actions.keyword')" :hint="t('rail.actions.keywordHint')" name="rail-keyword">
      <UInput
        v-model="keyword"
        size="sm"
        class="w-full"
        :placeholder="t('rail.actions.keywordPlaceholder')"
        :disabled="fixing"
        data-testid="rail-keyword"
      />
    </UFormField>

    <div class="flex flex-col gap-2">
      <UButton
        size="sm"
        block
        icon="i-heroicons-wrench-screwdriver"
        :label="t('rail.actions.fix')"
        :loading="fixing"
        data-testid="rail-fix"
        @click="handleFix"
      />
      <UButton
        size="sm"
        block
        variant="outline"
        color="neutral"
        icon="i-heroicons-arrow-path"
        :label="t('rail.actions.regenerate')"
        :loading="writing"
        data-testid="rail-regenerate"
        @click="handleRegenerate"
      />
    </div>
  </div>
</template>