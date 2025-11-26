<script lang="ts" setup>
/**
 *
 * Posts Board View Component Description: Displays posts in a board layout, grouped by status.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { computed } from 'vue';
import DefaultPreview from '../DefaultPreview.vue';
import type { PlatformPost, PostWithAllData, PublishDetail } from '#layers/BaseDB/db/posts/posts';
import dayjs from 'dayjs';

const props = defineProps<{
  posts: PostWithAllData[];
}>();

const postStatuses = ['pending', 'published', 'failed',]; // Example statuses

const groupedPosts = computed(() => {
  const groups: Record<string, PostWithAllData[]> = {};
  postStatuses.forEach(status => {
    groups[status] = [];
  });

  props.posts.forEach(post => {
    const status = post.status || 'draft'; // Default to Draft if no platform status
    if (groups[status]) {
      groups[status].push(post);
    } else {
      // If a status exists that's not in our predefined list, add it to a 'Miscellaneous' or 'Other' category
      if (!groups.Other) {
        groups.Other = [];
      }
      groups.Other.push(post);
    }
  });
  return groups;
});
const getPlatformDetails = (platform: PlatformPost): PublishDetail => {
  const details = JSON.parse(platform.publishDetail as unknown as string || '{}');
  return new Map(Object.entries(details));
};
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div v-for="(postsInGroup, status) in groupedPosts" :key="status"
      class="bg-gray-900/10 dark:bg-gray-800/10 p-4 rounded-lg shadow">
      <h3 class="font-bold text-lg mb-3">{{ status.toLocaleUpperCase() }} ({{ postsInGroup.length }})</h3>
      <div class="space-y-3">
        <template v-for="post in postsInGroup" :key="post.id" :show-bg="false">
          <UCard :ui="{ header: 'p-0 sm:p-2', footer: 'p-0 sm:p-2', body: 'p-0 sm:p-0 h-full', root: 'p-1' }"
            class="bg-old-neutral-950/30 dark:bg-background border border-muted hover:bg-background/10 dark:hover:bg-background transition-all delay-75 group/number h-full relative">
            <template #header>

            </template>
            <div class="bg-background shrink-0 rounded-lg overflow-hidden ">
              <div class="px-3 py-2.5">
                <div class="flex items-center gap-2 mb-2">
                  <div class="size-5 mt-0.5 shrink-0 flex items-center justify-center bg-muted rounded-sm p-1">
                    <UIcon name="lucide:clock" class="size-3" />
                  </div>
                  <h3 class="text-sm font-medium leading-tight flex-1">{{ dayjs(post.createdAt).format('MMM DD') }}</h3>
                </div>
                <p class="text-xs text-muted-foreground mb-3 text-clip " style="text-spacing-trim: none;">
                  {{ post.content }}
                </p>
                <div class="flex flex-wrap flex-row gap-1.5">
                  <UBadge color="primary" variant="outline" v-for="platform in post.platformPosts" :key="platform.id">
                    <Icon :name="`logos:${platform.platformPostId ?? 'facebook'}`" class="size-3" />
                    {{ platform.status }}
                  </UBadge>
                </div>
              </div>
              <div class="px-3 py-2.5 border-t border-border border-dashed">
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <div class="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <UBadge color="neutral" variant="soft">
                      <UIcon name="lucide:clock" class="size-3" />
                      {{ dayjs(post.createdAt).format('MMM DD') }}
                    </UBadge>
                    <UBadge color="neutral" variant="soft">
                      <UIcon name="lucide:image" class="size-3" />
                      {{ post.assets.length }}
                    </UBadge>
                    <UBadge color="neutral" variant="soft">
                      <UIcon name="lucide:text-select" class="size-3" />
                      {{ post.user.name }}
                    </UBadge>
                  </div>
                </div>
              </div>
              <div class="px-3 py-2.5 border-t border-border border-dashed mt-5" v-if="status === 'published'">
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <div class="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <UButton color="neutral" variant="soft" v-for="platform in post.platformPosts" :key="platform.id"
                      target="_blank" :to="getPlatformDetails(platform).get(platform.socialAccountId)?.publishedUrl">
                      <UIcon name="lucide:link" class="size-3" />
                      {{ getPlatformDetails(platform).get(platform.socialAccountId)?.publishedUrl ?
                        `${platform.platformPostId} URL`
                        : "No url" }}
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any scoped styles here if needed */
</style>
