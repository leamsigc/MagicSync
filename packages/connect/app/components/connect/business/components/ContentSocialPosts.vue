<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import type { ContentPlatformPost } from '../../../../composables/useContentEditor'

/**
 * The per-platform social posts the writer chain produced. They are captions,
 * not markdown — a `#hashtag` must stay a hashtag — so they render as plain
 * text with their line breaks intact.
 *
 * `title` is the host's: rendered only when given, so the rail's Social section
 * can show these as a labelled sub-block without a second competing heading.
 */

const props = defineProps<{
  posts: ContentPlatformPost[]
  title?: string
}>()

const { t } = useI18n()
</script>

<template>
  <section data-testid="social-posts">
    <h2 v-if="props.title" class="text-[11px] font-semibold uppercase tracking-wider text-muted">
      {{ props.title }}
    </h2>
    <p v-if="posts.length === 0" class="mt-2 text-xs text-muted">
      {{ t('idea.social.empty') }}
    </p>
    <div v-else class="mt-2 space-y-3">
      <article v-for="post in posts" :key="post.platform" :data-testid="`social-post-${post.platform}`">
        <UBadge color="neutral" variant="outline" size="xs">{{ post.platform }}</UBadge>
        <p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-highlighted">{{ post.caption }}</p>
      </article>
    </div>
  </section>
</template>