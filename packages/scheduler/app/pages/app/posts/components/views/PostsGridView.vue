<script lang="ts" setup>
import DefaultPreview from '../DefaultPreview.vue';
import type { PostWithAllData } from '#layers/BaseDB/db/posts/posts';

const props = defineProps<{
  posts: PostWithAllData[];
}>();
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
    <div v-for="post in posts" :key="post.id"
      class="bg-elevated rounded-xl hover:shadow-sm hover:-translate-y-0.5 transition-all duration-180  overflow-hidden group">
      <div class="p-3">
        <div class="flex items-center gap-2 mb-3">
          <template v-for="platform in post.platformPosts" :key="platform.id">
            <UChip
              :color="platform.status === 'published' ? 'success' : platform.status === 'pending' ? 'warning' : 'error'">
              <UButton :icon="`logos:${platform.platformPostId}`" color="neutral" variant="ghost" size="xs" />
            </UChip>
          </template>
        </div>
        <DefaultPreview :post-content="post.content" :media-assets="post.assets" platform="default" :post="{
          businessId: post.businessId,
          scheduledAt: post.scheduledAt || new Date(),
          status: post.status,
          targetPlatforms: post.targetPlatforms ? JSON.parse(post.targetPlatforms) : [],
          comment: [],
          content: post.content,
          mediaAssets: post.mediaAssets ? JSON.parse(post.mediaAssets) : [],
        }" />
      </div>
    </div>
  </div>
</template>

<style scoped></style>
