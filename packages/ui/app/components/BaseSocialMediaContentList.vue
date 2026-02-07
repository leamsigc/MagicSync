<script lang="ts" setup>
/**
 * Component Description: Mock Twitter Page for Verification
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

setPageLayout('twitter-layout')
interface Post {
  avatar: string;
  name: string;
  handle: string;
  timestamp: string;
  content: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number;
  media?: string;
}
interface Props {
  list: Post[]
}
const props = defineProps<Props>();
const { list } = toRefs(props);
</script>

<template>
  <main>
    <!-- Editor at top of feed -->
    <TwitterMockEditor />


    <!-- Feed -->
    <div class="my-10">
      <TwitterPostCard v-for="(post, index) in list" :key="index" v-bind="post">
        <template #media v-if="post.media">
          <img :src="post.media" :alt="post.content" class="w-full h-full object-cover" />
        </template>
      </TwitterPostCard>
      <!-- Example with media slot -->
      <TwitterPostCard avatar="https://i.pravatar.cc/300?img=1" name="Alex Rivera" handle="@arivera_tech" timestamp="4h"
        content="Thinking about how AI is changing the landscape of social media. It is not about automation, it is about augmentation."
        :likes="858" :retweets="230" :replies="120" :views="8900">
        <template #media>
          <div class="bg-gray-100 dark:bg-zinc-900 h-64 w-full flex items-center justify-center text-gray-500">
            Image Placeholder
          </div>
        </template>
      </TwitterPostCard>

      <!-- Example with Image -->
      <TwitterPostCard avatar="https://i.pravatar.cc/300?img=5" name="Orbit Official" handle="@orbit_app" timestamp="1d"
        content="We are launching our new bulk import feature today! Schedule 100 posts in under 5 minutes."
        :likes="4200" :retweets="1200" :replies="540" :views="120000">
        <template #media>
          <img
            src="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=2669&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            class="w-full h-full object-cover" />
        </template>
      </TwitterPostCard>
    </div>
  </main>
</template>
