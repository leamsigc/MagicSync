<script lang="ts" setup>
import { computed } from 'vue';
import DefaultPreview from '../DefaultPreview.vue';
import type { PlatformPost, PostWithAllData, PublishDetail } from '#layers/BaseDB/db/posts/posts';
import dayjs from 'dayjs';

const props = defineProps<{
  posts: PostWithAllData[];
}>();

const postStatuses = ['pending', 'published', 'failed'];

const groupedPosts = computed(() => {
  const groups: Record<string, PostWithAllData[]> = {};
  postStatuses.forEach(status => {
    groups[status] = [];
  });

  props.posts.forEach(post => {
    const status = post.status || 'draft';
    if (groups[status]) {
      groups[status].push(post);
    } else {
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
  <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
    <div v-for="(postsInGroup, status) in groupedPosts" :key="status" class="bg-elevated rounded-2xl  overflow-hidden">
      <div class="px-4 py-3.5 ">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" :class="{
            'bg-warning': status === 'pending',
            'bg-success': status === 'published',
            'bg-error': status === 'failed',
            'bg-muted': status === 'Other'
          }" />
          <h3 class="font-semibold text-sm text-highlighted">{{ status.toLocaleUpperCase() }}</h3>
          <UBadge variant="soft" size="xs" color="neutral">{{ postsInGroup.length }}</UBadge>
        </div>
      </div>
      <div class="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
        <template v-for="post in postsInGroup" :key="post.id">
          <div
            class="bg-elevated rounded-xl hover:shadow-sm hover:-translate-y-0.5 transition-all duration-180  overflow-hidden">
            <div class="p-3.5 space-y-3">
              <div class="flex items-center gap-2">
                <div class="size-5 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0">
                  <UIcon name="lucide:clock" class="size-3 text-muted" />
                </div>
                <h3 class="text-sm font-medium text-highlighted flex-1">{{ dayjs(post.createdAt).format('MMM DD') }}
                </h3>
              </div>
              <p class="text-sm text-toned line-clamp-3 leading-relaxed">{{ post.content }}</p>
              <div class="flex flex-wrap gap-1.5">
                <UBadge color="primary" variant="soft" size="xs" v-for="platform in post.platformPosts"
                  :key="platform.id">
                  <Icon :name="`logos:${platform.platformPostId ?? 'facebook'}`" class="size-3" />
                  {{ platform.status }}
                </UBadge>
              </div>
              <div class="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border/30">
                <div class="flex items-center gap-2 text-xs text-muted flex-wrap">
                  <UBadge color="neutral" variant="soft" size="xs">
                    <UIcon name="lucide:clock" class="size-3" />
                    {{ dayjs(post.createdAt).format('MMM DD') }}
                  </UBadge>
                  <UBadge color="neutral" variant="soft" size="xs">
                    <UIcon name="lucide:image" class="size-3" />
                    {{ post.assets.length }}
                  </UBadge>
                  <UBadge color="neutral" variant="soft" size="xs">
                    <UIcon name="lucide:text-select" class="size-3" />
                    {{ post.user.name }}
                  </UBadge>
                </div>
              </div>
              <div v-if="status === 'published'" class="pt-2 border-t border-border/30">
                <div class="flex items-center gap-2 flex-wrap">
                  <UButton color="neutral" variant="soft" size="xs" v-for="platform in post.platformPosts"
                    :key="platform.id" target="_blank" class="rounded-lg"
                    :to="getPlatformDetails(platform).get(platform.socialAccountId)?.publishedUrl">
                    <UIcon name="lucide:link" class="size-3" />
                    {{ getPlatformDetails(platform).get(platform.socialAccountId)?.publishedUrl ?
                      `${platform.platformPostId}` : "No url" }}
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
