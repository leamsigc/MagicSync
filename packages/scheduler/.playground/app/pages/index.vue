<script setup lang="ts">
/**
 * Throwaway W6 verification harness — renders every platform in the preview
 * registry in both published and pending modes, so the build graph contains
 * every renderer (nothing imports them yet) and every SFC compiles.
 * Deleted after the build; not shipped.
 */
import type { Asset, PostCreateBase } from '#layers/BaseDB/db/schema'
import {
  PREVIEW_PLATFORMS,
  resolvePreviewComponent
} from '#layers/BaseScheduler/app/components/scheduler/posts/previews/previewRegistry'

function asset(id: string, mimeType: string): Asset {
  return {
    id,
    userId: 'harness',
    businessId: null,
    folderId: null,
    filename: `${id}.bin`,
    originalName: `${id}.bin`,
    mimeType,
    size: 1024,
    url: `https://placehold.co/600x600?text=${id}`,
    thumbnailUrl: null,
    metadata: null,
    isPublic: true,
    createdAt: new Date()
  }
}

const MEDIA = [
  asset('one', 'image/png'),
  asset('two', 'image/png'),
  asset('three', 'image/png'),
  asset('four', 'image/png')
]

function post(status: 'pending' | 'published'): PostCreateBase {
  return {
    content: 'Harness post copy with a #hashtag and a link https://example.com/harness',
    mediaAssets: ['one', 'two', 'three', 'four'],
    scheduledAt: new Date('2026-10-09T15:30:00Z'),
    status,
    targetPlatforms: PREVIEW_PLATFORMS,
    platformContent: {
      reddit: { content: 'Overridden copy for the subreddit r/harness' }
    },
    platformSettings: {
      twitter: { __type: 'twitter', who_can_reply: 'following' },
      google: { __type: 'gmb', topicType: 'OFFER', callToActionType: 'LEARN_MORE' },
      devto: { __type: 'devto', title: 'Harness article', tags: [{ value: 'nuxt', label: 'nuxt' }] },
      wordpress: { __type: 'wordpress', title: 'Harness page' },
      dribbble: { __type: 'dribbble', title: 'Harness shot', tags: ['ui'] },
      pinterest: { __type: 'pinterest', title: 'Harness pin', board: 'Inspiration' },
      youtube: { __type: 'youtube', title: 'Harness upload', postType: 'short' },
      reddit: { __type: 'reddit', type: 'image', subreddit: { value: 'harness', title: 'Harness', type: 'public', url: 'https://reddit.com/r/harness/', is_flair_required: false } }
    },
    comment: ['First real comment', 'Second real comment'],
    postFormat: 'post'
  } as unknown as PostCreateBase
}

const PUBLISHED = post('published')
const PENDING = post('pending')
</script>

<template>
  <main class="mx-auto max-w-5xl space-y-10 p-8">
    <section>
      <h1 class="mb-4 text-2xl font-bold">Published</h1>
      <div class="grid gap-6 md:grid-cols-2">
        <div v-for="platform in PREVIEW_PLATFORMS" :key="`p-${platform}`">
          <p class="mb-2 font-mono text-sm">{{ platform }}</p>
          <component
            :is="resolvePreviewComponent(platform)"
            :post-content="PUBLISHED.content" :media-assets="MEDIA"
            :platform="platform"
            :post="PUBLISHED"
          />
        </div>
      </div>
    </section>

    <section>
      <h1 class="mb-4 text-2xl font-bold">Pending</h1>
      <div class="grid gap-6 md:grid-cols-2">
        <div v-for="platform in PREVIEW_PLATFORMS" :key="`d-${platform}`">
          <p class="mb-2 font-mono text-sm">{{ platform }}</p>
          <component
            :is="resolvePreviewComponent(platform)"
            :post-content="PENDING.content" :media-assets="MEDIA"
            :platform="platform"
            :post="PENDING"
          />
        </div>
      </div>
    </section>
  </main>
</template>
