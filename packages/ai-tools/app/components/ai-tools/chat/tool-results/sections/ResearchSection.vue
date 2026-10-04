<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { parseSectionPayload, type ToolCallLike } from '../../../../../composables/ai-tools/chat/runSections'

const props = defineProps<{
  calls: ToolCallLike[]
}>()

const { t } = useI18n()

interface ResearchItem {
  title: string
  text: string
}

function briefOf(call: ToolCallLike): string {
  const payload = parseSectionPayload(call.result)
  return typeof payload?.brief === 'string' ? payload.brief : ''
}

function resultsOf(call: ToolCallLike): ResearchItem[] {
  const payload = parseSectionPayload(call.result)
  const raw = Array.isArray(payload?.results) ? payload.results as Array<Record<string, unknown>> : []
  return raw.slice(0, 3).map(entry => ({
    title: String(entry.title ?? entry.label ?? ''),
    text: String(entry.text ?? entry.content ?? '').slice(0, 320),
  }))
}

function bestPostsOf(call: ToolCallLike): Array<{ content: string, rate: string }> {
  const payload = parseSectionPayload(call.result)
  const raw = Array.isArray(payload?.bestPosts) ? payload.bestPosts as Array<Record<string, unknown>> : []
  return raw.slice(0, 3).map(entry => ({
    content: String(entry.content ?? '').slice(0, 260),
    rate: String(entry.engagementRate ?? ''),
  }))
}

function hasContent(call: ToolCallLike): boolean {
  return briefOf(call) !== '' || resultsOf(call).length > 0 || bestPostsOf(call).length > 0 || Boolean(call.error)
}
</script>

<template>
  <section v-motion-fade data-testid="run-section" data-kind="research" :duration="200" class="space-y-2">
    <div v-for="call in calls" :key="call.id">
      <template v-if="hasContent(call)">
        <div v-if="call.error" class="rounded-xl bg-error/10 p-3">
          <p class="text-sm whitespace-pre-wrap text-error/90">{{ call.error }}</p>
        </div>
        <template v-else>
          <div v-if="briefOf(call)" class="rounded-xl bg-default p-3">
            <Markdown :value="briefOf(call)" class="text-sm" />
          </div>
          <div v-if="resultsOf(call).length" class="mt-2 space-y-1.5">
            <div v-for="(item, idx) in resultsOf(call)" :key="idx" class="rounded-xl bg-default p-3">
              <p class="text-sm font-semibold">{{ item.title }}</p>
              <Markdown :value="item.text" class="text-xs text-muted" />
            </div>
          </div>
          <div v-if="bestPostsOf(call).length" class="mt-2 space-y-1.5">
            <div v-for="(post, idx) in bestPostsOf(call)" :key="idx" class="rounded-xl bg-default p-3">
              <Markdown :value="post.content" class="text-xs" />
              <p class="mt-1 text-xs text-muted">{{ t('workflow.engagement', { rate: post.rate }) }}</p>
            </div>
          </div>
        </template>
      </template>
    </div>
  </section>
</template>
