<script setup lang="ts">
/**
 * Agent connect instructions — brand mark, tagline and the four MCP steps.
 *
 * Used from the `for/<agent>.md` content files as `::AgentConnect`. Copy for
 * the steps lives in `packages/site/translations/global.json` under
 * `agentConnect` (en/es/de/fr); the per-agent tagline is passed by the
 * markdown so each page keeps its own voice.
 */
import { agentBrand } from '../utils/agentRegistry'

interface Props {
  /** Agent slug from `for/<slug>.md`, e.g. `chatgpt`. */
  agent: string
  /** Localized one-liner shown under the agent name. */
  tagline?: string
}

const props = defineProps<Props>()

const { t } = useI18n()
const toast = useToast()

const endpoint = 'https://magicsync.dev/mcp'
const brand = computed(() => agentBrand(props.agent))
const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

const steps = computed(() => [1, 2, 3, 4].map(number => ({
  number,
  title: t(`agentConnect.steps.${number}.title`, { agent: brand.value.name }),
  description: t(`agentConnect.steps.${number}.description`, {
    agent: brand.value.name,
    endpoint
  })
})))

async function copyEndpoint() {
  try {
    if (!navigator.clipboard) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(endpoint)
    copied.value = true
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => { copied.value = false }, 2000)
    toast.add({ title: t('agentConnect.copySuccess'), color: 'success', icon: 'i-lucide-check' })
  } catch {
    toast.add({ title: t('agentConnect.copyFailed'), color: 'error', icon: 'i-lucide-alert-triangle' })
  }
}

onBeforeUnmount(() => clearTimeout(resetTimer))
</script>

<template>
  <section id="connect" class="container mx-auto px-4 py-16 md:py-20">
    <div
      class="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-default bg-card/70 p-6 shadow-sm md:p-10"
      v-motion-fade-visible-once>
      <div aria-hidden="true"
        class="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />

      <header class="relative flex flex-col items-center gap-4 text-center">
        <span
          class="grid size-16 place-items-center rounded-2xl border border-default bg-background shadow-sm md:size-20">
          <UIcon :name="brand.icon" class="size-9 md:size-11" />
        </span>
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {{ t('agentConnect.eyebrow') }}
          </p>
          <h2 class="text-2xl font-bold md:text-3xl">
            {{ brand.name }}
          </h2>
          <p v-if="tagline" class="mx-auto max-w-2xl text-muted-foreground">
            {{ tagline }}
          </p>
        </div>
      </header>

      <h3 class="relative mt-10 text-center text-lg font-semibold md:text-xl">
        {{ t('agentConnect.title', { agent: brand.name }) }}
      </h3>

      <ol class="relative mt-6 grid gap-4 sm:grid-cols-2">
        <li v-for="step in steps" :key="step.number"
          class="group rounded-2xl border border-default bg-background/80 p-5 transition-colors hover:border-primary/40">
          <div class="flex items-center gap-3">
            <span
              class="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {{ step.number }}
            </span>
            <p class="font-semibold">
              {{ step.title }}
            </p>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
            {{ step.description }}
          </p>
        </li>
      </ol>

      <div
        class="relative mt-6 flex flex-col gap-4 rounded-2xl border border-default bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {{ t('agentConnect.endpointLabel') }}
          </p>
          <code class="mt-1 block truncate font-mono text-sm md:text-base">{{ endpoint }}</code>
        </div>
        <UButton :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" :color="copied ? 'success' : 'primary'"
          variant="soft" :aria-label="copied ? t('agentConnect.copied') : t('agentConnect.copy')" @click="copyEndpoint">
          {{ copied ? t('agentConnect.copied') : t('agentConnect.copy') }}
        </UButton>
      </div>
    </div>
  </section>
</template>
