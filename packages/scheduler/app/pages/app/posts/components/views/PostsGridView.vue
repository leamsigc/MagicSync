<script lang="ts" setup>

import DefaultPreview from '../DefaultPreview.vue';
/**
 *
 * Posts Grid View Component Description: Displays posts in a grid layout.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { PostWithAllData } from '#layers/BaseDB/db/posts/posts';

const props = defineProps<{
  posts: PostWithAllData[];
}>();

</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3">
    <BaseShinyCard v-for="post in posts" :key="post.id" :show-bg="false">
      <UCard :ui="{ header: 'p-0 sm:p-2', footer: 'p-0 sm:p-2', body: 'p-0 sm:p-0 h-full', root: 'p-1' }"
        class="bg-muted/50 dark:bg-card hover:bg-background dark:hover:bg-background transition-all delay-75 group/number h-full relative">
        <template #header>
          <div class="flex items-center gap-2 p-2">
            <template v-for="platform in post.platformPosts" :key="platform.id">
              <UChip
                :color="platform.status === 'published' ? 'primary' : platform.status === 'pending' ? 'warning' : 'error'">
                <UButton :icon="`logos:${platform.platformPostId}`" color="neutral" variant="ghost" />
              </UChip>
            </template>
          </div>
        </template>
        <DefaultPreview :post-content="post.content" :media-assets="post.assets" platform="default" :post="{
          businessId: post.businessId,
          scheduledAt: post.scheduledAt || new Date(),
          status: post.status,
          targetPlatforms: post.targetPlatforms ? JSON.parse(post.targetPlatforms) : [],
          comment: [],
          content: post.content,
          mediaAssets: post.mediaAssets ? JSON.parse(post.mediaAssets) : [],
        }" />
      </UCard>
    </BaseShinyCard>
  </div>
</template>

<style scoped>
/* Add any scoped styles here if needed */
</style>
