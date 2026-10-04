<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import {
  useOperatorApprovals,
  useOperatorClock,
  type ApprovalDecision,
} from '../../../composables/ai-tools/chat/useOperatorConsole'
import { relativeTime, type AwaitingApproval } from '../../../composables/ai-tools/chat/operatorConsoleData'

const props = defineProps<{
  businessId?: string | null
  isStreaming?: boolean
}>()

const { t } = useI18n()
const now = useOperatorClock()
const { decide, items, load, loading, pendingDecision, pendingId } = useOperatorApprovals(() => props.businessId ?? undefined)

onMounted(() => {
  void load()
})

watch(() => props.businessId, () => {
  void load()
})

watch(() => props.isStreaming, (streaming, previous) => {
  if (previous && !streaming) void load()
})

function timeLabel(at: string): string {
  const relative = relativeTime(at, now.value)
  return t(`activity.time.${relative.key}`, { count: relative.count })
}

function kindLabel(item: AwaitingApproval): string {
  return t(`operator.kinds.${item.kindKey}`)
}

function busyFor(item: AwaitingApproval, decision: ApprovalDecision): boolean {
  return pendingId.value === item.id && pendingDecision.value === decision
}

function handleApprove(item: AwaitingApproval): void {
  void decide(item, 'approved')
}

function handleReject(item: AwaitingApproval): void {
  void decide(item, 'rejected')
}
</script>

<template>
  <section class="flex flex-col" data-testid="operator-approvals">
    <header class="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
      <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">
        {{ t('operator.approvalsTitle') }}
      </h2>
      <UBadge :color="items.length > 0 ? 'warning' : 'neutral'" variant="subtle" size="xs">
        {{ items.length }}
      </UBadge>
    </header>

    <p v-if="loading && items.length === 0" v-motion-fade :duration="200" class="px-4 pb-3 text-xs text-muted">
      {{ t('operator.approvalsLoading') }}
    </p>
    <p v-else-if="items.length === 0" v-motion-fade :duration="200" class="px-4 pb-3 text-xs text-muted">
      {{ t('operator.approvalsEmpty') }}
    </p>

    <ul v-else class="max-h-[45vh] space-y-2 overflow-y-auto px-3 pb-3">
      <li
        v-for="item in items"
        :key="item.id"
        v-motion-fade
        :duration="200"
        class="rounded-xl border border-default bg-elevated p-3"
      >
        <div class="flex items-center justify-between gap-2">
          <UBadge color="primary" variant="subtle" size="xs">
            {{ kindLabel(item) }}
          </UBadge>
          <span class="shrink-0 text-[11px] text-muted">{{ timeLabel(item.at) }}</span>
        </div>
        <p class="mt-2 line-clamp-3 text-sm leading-5 text-highlighted">
          {{ item.preview || t('operator.artifactUntitled') }}
        </p>
        <div class="mt-3 flex items-center gap-2">
          <UButton
            size="xs"
            color="primary"
            :label="t('operator.approve')"
            :loading="busyFor(item, 'approved')"
            :disabled="pendingId !== null"
            @click="handleApprove(item)"
          />
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            :label="t('operator.reject')"
            :loading="busyFor(item, 'rejected')"
            :disabled="pendingId !== null"
            @click="handleReject(item)"
          />
        </div>
      </li>
    </ul>
  </section>
</template>
