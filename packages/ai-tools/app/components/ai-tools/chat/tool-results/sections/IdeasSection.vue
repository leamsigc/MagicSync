<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { parseSectionPayload, type ToolCallLike } from '../../../../../composables/ai-tools/chat/runSections'

const props = defineProps<{
  calls: ToolCallLike[]
}>()

const { t } = useI18n()

interface Idea {
  title: string
  brief: string
  platforms: string[]
}

function ideasOf(call: ToolCallLike): Idea[] {
  const payload = parseSectionPayload(call.result)
  const rawIdeas = Array.isArray(payload?.ideas) ? payload.ideas as Array<Record<string, unknown>> : []
  const rawHooks = Array.isArray(payload?.hooks) ? payload.hooks as Array<Record<string, unknown>> : []
  const ideas = rawIdeas.map(entry => ({
    title: String(entry.title ?? ''),
    brief: String(entry.brief ?? ''),
    platforms: Array.isArray(entry.platforms) ? (entry.platforms as unknown[]).filter((p): p is string => typeof p === 'string') : [],
  })).filter(idea => idea.title !== '')
  const hooks = rawHooks.map(entry => ({
    title: String(entry.hook ?? entry.title ?? ''),
    brief: '',
    platforms: [] as string[],
  })).filter(idea => idea.title !== '')
  return [...ideas, ...hooks].slice(0, 10)
}

function emptyIdeas(): boolean {
  return props.calls.every(call => ideasOf(call).length === 0 && !call.error)
}
</script>

<template>
  <section v-motion-fade data-testid="run-section" data-kind="ideas" :duration="200" class="space-y-2">
    <p class="text-xs font-medium text-muted">{{ t('sections.ideasTitle') }}</p>
    <div v-for="call in calls" :key="call.id">
      <div v-if="call.error" class="rounded-xl bg-error/10 p-3">
        <p class="text-sm whitespace-pre-wrap text-error/90">{{ call.error }}</p>
      </div>
      <div v-else-if="ideasOf(call).length" class="space-y-1.5">
        <div v-for="(idea, idx) in ideasOf(call)" :key="idx" class="rounded-xl bg-default p-3">
          <p class="text-sm font-semibold">{{ idea.title }}</p>
          <Markdown v-if="idea.brief" :value="idea.brief.slice(0, 300)" class="mt-1 text-xs text-muted" />
          <div v-if="idea.platforms.length" class="mt-1.5 flex flex-wrap gap-1">
            <UBadge v-for="platform in idea.platforms" :key="platform" variant="outline" size="xs">{{ platform }}</UBadge>
          </div>
        </div>
      </div>
    </div>
    <div v-if="emptyIdeas()" class="rounded-xl bg-default p-3">
      <p class="text-sm whitespace-pre-wrap text-muted">{{ t('workflow.noOutput') }}</p>
    </div>
  </section>
</template>
