<script lang="ts" setup>
/**
 *
 * Component Description: X-style feed view of all posts.
 * Posts render one after another (like a social timeline) and each
 * card links to its detail page (/app/posts/feeds/[id]).
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.2
 */
import type { PostWithAllData } from '#layers/BaseDB/db/schema';
import PostFeedCard from '../PostFeedCard.vue';

const props = defineProps<{
  posts: PostWithAllData[];
}>();
</script>

<template>
  <div class="max-w-2xl mx-auto mt-4">
    <div
v-if="props.posts.length"
      class="bg-elevated rounded-2xl border border-border overflow-hidden divide-y divide-border">
      <PostFeedCard v-for="post in props.posts" :key="post.id" :post="post" />
    </div>

    <div v-else class="bg-elevated rounded-2xl border border-border text-center py-16">
      <UIcon name="i-heroicons-newspaper" class="w-14 h-14 text-dimmed mx-auto mb-4" />
      <p class="text-muted text-lg">{{ $t('feeds.noPostsFound') }}</p>
    </div>

    <div v-if="props.posts.length" class="text-center mt-4">
      <NuxtLink
to="/app/posts/feeds"
        class="text-sm text-primary hover:underline inline-flex items-center gap-1.5 min-h-11 justify-center w-full sm:w-auto sm:min-h-0">
        {{ $t('feeds.openFullFeed') }}
        <UIcon name="i-lucide-arrow-right" class="size-4" />
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped></style>
