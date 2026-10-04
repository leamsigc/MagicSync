<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { parseSectionPayload, type ToolCallLike } from '../../../../../composables/ai-tools/chat/runSections'

defineProps<{
  calls: ToolCallLike[]
}>()

function firstString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function cardOf(call: ToolCallLike): Record<string, unknown> | null {
  const payload = parseSectionPayload(call.result)
  const card = payload?.card
  return card && typeof card === 'object' && !Array.isArray(card) ? card as Record<string, unknown> : null
}

function cardsOf(call: ToolCallLike): Array<Record<string, unknown>> {
  const payload = parseSectionPayload(call.result)
  const raw = Array.isArray(payload?.cards) ? payload.cards as Array<Record<string, unknown>> : []
  return raw.slice(0, 5)
}

function platformsOf(card: Record<string, unknown>): string[] {
  return Array.isArray(card.platforms) ? (card.platforms as unknown[]).filter((p): p is string => typeof p === 'string') : []
}
</script>

<template>
  <section v-motion-fade data-testid="run-section" data-kind="board" :duration="200" class="space-y-2">
    <div v-for="call in calls" :key="call.id">
      <div v-if="call.error" class="rounded-xl bg-error/10 p-3">
        <p class="text-sm whitespace-pre-wrap text-error/90">{{ call.error }}</p>
      </div>
      <template v-else>
        <div v-if="cardOf(call)" class="rounded-xl border border-default bg-default p-3">
          <div class="flex items-center justify-between gap-2">
            <p class="truncate text-sm font-semibold">{{ String(cardOf(call)?.title ?? '') }}</p>
            <UBadge :color="cardOf(call)?.state === 'review_required' ? 'success' : 'neutral'" variant="subtle" size="xs">{{ String(cardOf(call)?.state ?? '') }}</UBadge>
          </div>
          <div v-if="platformsOf(cardOf(call) ?? {}).length" class="mt-1.5 flex flex-wrap gap-1">
            <UBadge v-for="plat in platformsOf(cardOf(call) ?? {})" :key="plat" variant="outline" size="xs">{{ plat }}</UBadge>
          </div>
          <div v-if="firstString(cardOf(call)?.brief)" class="mt-2 rounded-lg bg-elevated p-2.5">
            <Markdown :value="String(cardOf(call)?.brief).slice(0, 600)" class="text-xs" />
          </div>
          <div v-if="cardOf(call)?.from || cardOf(call)?.to" class="mt-2 flex items-center gap-2 text-xs">
            <span class="text-muted">{{ String(cardOf(call)?.from ?? '') }}</span>
            <UIcon name="i-heroicons-arrow-right" class="h-3 w-3" />
            <span class="font-medium">{{ String(cardOf(call)?.to ?? '') }}</span>
          </div>
        </div>
        <div v-if="cardsOf(call).length" class="space-y-1.5">
          <div v-for="card in cardsOf(call)" :key="String(card.id ?? '')" class="flex items-center justify-between gap-2 rounded-xl bg-default p-2.5 text-xs">
            <div class="min-w-0">
              <p class="truncate font-semibold">{{ String(card.title ?? '') }}</p>
              <p class="truncate text-muted">{{ String(card.brief ?? '').slice(0, 90) }}</p>
            </div>
            <UBadge variant="subtle" size="xs" class="ml-2 shrink-0">{{ String(card.state ?? '') }}</UBadge>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
