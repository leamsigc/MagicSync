<script setup lang="ts">
/**
 * Other agents + platform integrations — the cross-links at the bottom of every
 * `for/<agent>.md` page, rendered as `::AgentOtherAgents`.
 *
 * The current agent is filtered out so each page promotes only its siblings.
 */
import { AGENT_BRANDS, agentDescription, platformName } from '../utils/agentRegistry'

interface Props {
  /** Current agent slug, excluded from the grid. */
  agent?: string
  /** Show the platform chip row. */
  platforms?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  agent: '',
  platforms: true
})

const { t } = useI18n()

const others = computed(() => AGENT_BRANDS.filter(brand => brand.slug !== props.agent))

const channels = [
  { slug: 'facebook', icon: 'i-simple-icons:facebook' },
  { slug: 'instagram', icon: 'i-simple-icons:instagram' },
  { slug: 'twitter', icon: 'i-simple-icons:x' },
  { slug: 'linkedin', icon: 'i-simple-icons:linkedin' },
  { slug: 'tiktok', icon: 'i-simple-icons:tiktok' },
  { slug: 'youtube', icon: 'i-simple-icons:youtube' },
  { slug: 'threads', icon: 'i-simple-icons:threads' },
  { slug: 'bluesky', icon: 'i-simple-icons:bluesky' },
  { slug: 'pinterest', icon: 'i-simple-icons:pinterest' },
  { slug: 'reddit', icon: 'i-simple-icons:reddit' },
  { slug: 'discord', icon: 'i-simple-icons:discord' },
  { slug: 'dribbble', icon: 'i-simple-icons:dribbble' },
  { slug: 'devto', icon: 'i-simple-icons:devdotto' },
  { slug: 'wordpress', icon: 'i-simple-icons:wordpress' },
  { slug: 'mastodon', icon: 'i-simple-icons:mastodon' },
  { slug: 'snapchat', icon: 'i-simple-icons:snapchat' },
  { slug: 'google-my-business', icon: 'i-simple-icons:google' }
]
</script>

<template>
  <section id="other-agents" class="container mx-auto px-4 py-16 md:py-20">
    <div class="mx-auto max-w-6xl" v-motion-fade-visible-once>
      <header class="max-w-2xl">
        <h2 class="text-2xl font-bold md:text-3xl">
          {{ t('agentOther.title') }}
        </h2>
        <p class="mt-2 text-muted-foreground">
          {{ t('agentOther.description') }}
        </p>
      </header>

      <ul class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="brand in others" :key="brand.slug">
          <NuxtLinkLocale :to="`/for/${brand.slug}`" :title="brand.name"
            class="group flex h-full flex-col gap-3 rounded-2xl border border-default bg-card/70 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <span class="grid size-10 place-items-center rounded-xl border border-default bg-background">
              <UIcon :name="brand.icon" class="size-5" />
            </span>
            <div class="flex-1">
              <p class="font-semibold">
                {{ brand.name }}
              </p>
              <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
                {{ t(agentDescription(brand.slug)) }}
              </p>
            </div>
            <span class="inline-flex items-center gap-1 text-sm font-medium text-primary">
              {{ t('agentOther.guide') }}
              <UIcon name="i-lucide-arrow-right" class="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </NuxtLinkLocale>
        </li>
      </ul>

      <div v-if="platforms" class="mt-10 rounded-2xl border border-default bg-muted/40 p-5">
        <p class="text-sm font-semibold">
          {{ t('agentOther.platformsTitle') }}
        </p>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ t('agentOther.platformsDescription') }}
        </p>
        <ul class="mt-4 flex flex-wrap gap-2">
          <li v-for="channel in channels" :key="channel.slug">
            <NuxtLinkLocale :to="`/platform/${channel.slug}`" :title="platformName(channel.slug)"
              class="inline-flex items-center gap-1.5 rounded-full border border-default bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary">
              <UIcon :name="channel.icon" class="size-3.5" />
              {{ platformName(channel.slug) }}
            </NuxtLinkLocale>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
