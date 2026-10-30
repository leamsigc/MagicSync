<script setup lang="ts">
/**
 * Prompt preview mock — a chat bubble, the MCP tool events it triggers and the
 * scheduled result. Used from `for/<agent>.md` as `::AgentPromptMock`, replacing
 * the plain blockquotes under "Prompts to try".
 *
 * Replay remounts the animated list (CSS delays, no timers) and advances to the
 * next example prompt, so every page demonstrates all three.
 */
const { t } = useI18n()

const playCount = ref(0)

const prompts = computed(() => [
  t('agentPrompt.prompt1'),
  t('agentPrompt.prompt2'),
  t('agentPrompt.prompt3')
])

const prompt = computed(() => prompts.value[playCount.value % prompts.value.length])

const events = computed(() => [
  { icon: 'i-lucide-search', title: t('agentPrompt.events.research'), detail: t('agentPrompt.events.researchDetail') },
  { icon: 'i-lucide-pen-line', title: t('agentPrompt.events.create'), detail: t('agentPrompt.events.createDetail') },
  { icon: 'i-lucide-image-plus', title: t('agentPrompt.events.attach'), detail: t('agentPrompt.events.attachDetail') },
  { icon: 'i-simple-icons:facebook', title: t('agentPrompt.events.schedule'), detail: t('agentPrompt.events.scheduleDetail') }
])

const platforms = [
  { label: 'Facebook', icon: 'i-simple-icons:facebook' },
  { label: 'Instagram', icon: 'i-simple-icons:instagram' },
  { label: 'X', icon: 'i-simple-icons:x' },
  { label: 'LinkedIn', icon: 'i-simple-icons:linkedin' },
  { label: 'WordPress', icon: 'i-simple-icons:wordpress' }
]

function replayMock() {
  playCount.value += 1
}
</script>

<template>
  <section id="prompts" class="container mx-auto px-4 py-16 md:py-20">
    <div class="mx-auto max-w-3xl" v-motion-fade-visible-once>
      <h2 class="text-center text-2xl font-bold md:text-3xl">
        {{ t('agentPrompt.title') }}
      </h2>
      <p class="mt-2 text-center text-muted-foreground">
        {{ t('agentPrompt.description') }}
      </p>

      <div
        class="mt-8 overflow-hidden rounded-2xl border border-default bg-card shadow-md">
        <div class="flex items-center gap-2 border-b border-default bg-muted/50 px-4 py-3">
          <span class="size-2.5 rounded-full bg-red-400" />
          <span class="size-2.5 rounded-full bg-amber-400" />
          <span class="size-2.5 rounded-full bg-emerald-400" />
          <p class="ml-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {{ t('agentPrompt.windowLabel') }}
          </p>
        </div>

        <div :key="playCount" class="space-y-5 p-4 md:p-6">
          <div class="mock-item flex justify-end gap-2" style="--i: 0">
            <p
              class="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-relaxed text-inverted">
              {{ prompt }}
            </p>
            <span class="mt-auto grid size-8 shrink-0 place-items-center rounded-full bg-muted">
              <UIcon name="i-lucide-user" class="size-4 text-muted-foreground" />
            </span>
          </div>

          <ul class="space-y-2">
            <li
              v-for="(event, index) in events"
              :key="event.title"
              class="mock-item flex items-center gap-3 rounded-xl border border-default bg-background/80 px-3 py-2.5"
              :style="{ '--i': index + 1 }">
              <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10">
                <UIcon :name="event.icon" class="size-4 text-primary" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">
                  {{ event.title }}
                </p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ event.detail }}
                </p>
              </div>
              <UIcon name="i-lucide-circle-check" class="size-4 shrink-0 text-emerald-500" />
            </li>
          </ul>

          <div
            class="mock-item rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm leading-relaxed"
            style="--i: 5">
            {{ t('agentPrompt.answer') }}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-default bg-muted/40 px-4 py-3">
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              v-for="platform in platforms"
              :key="platform.label"
              class="inline-flex items-center gap-1.5 rounded-full border border-default bg-background px-2.5 py-1 text-xs font-medium">
              <UIcon :name="platform.icon" class="size-3.5" />
              {{ platform.label }}
            </span>
          </div>
          <UButton
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="t('agentPrompt.replay')"
            @click="replayMock">
            {{ t('agentPrompt.replay') }}
          </UButton>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@keyframes mock-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.mock-item {
  animation: mock-in 0.45s ease both;
  animation-delay: calc(var(--i, 0) * 0.45s + 0.15s);
}

@media (prefers-reduced-motion: reduce) {
  .mock-item {
    animation: none;
  }
}
</style>
