<script lang="ts" setup>

/**
*
* Post preview in the calendar
*
* @author Reflect-Media <reflect.media GmbH>
* @version 0.0.1
*
* @todo [ ] Test the component
* @todo [ ] Integration test.
* @todo [✔] Update the typescript.
*/

import type { Asset, PostCreateBase, PostWithAllData } from '#layers/BaseDB/db/schema';
import { usePlatformIcons, type SocialMediaPlatform } from '#layers/BaseUI/app/composables/usePlatformIcons';
import type { SocialMediaPlatformConfigurations } from '../pages/app/posts/composables/usePlatformConfiguration';
const FacebookPreview = defineAsyncComponent(() => import('../pages/app/posts/components/FacebookPreview.vue'));
const InstagramPreview = defineAsyncComponent(() => import('../pages/app/posts/components/InstagramPreview.vue'));
const TwitterPreview = defineAsyncComponent(() => import('../pages/app/posts/components/TwitterPreview.vue'));
const GooglePreview = defineAsyncComponent(() => import('../pages/app/posts/components/GooglePreview.vue'));
const EmailPasswordPreview = defineAsyncComponent(() => import('../pages/app/posts/components/EmailPasswordPreview.vue'));
const LinkedinPreview = defineAsyncComponent(() => import('../pages/app/posts/components/LinkedinPreview.vue'));
const TiktokPreview = defineAsyncComponent(() => import('../pages/app/posts/components/TiktokPreview.vue'));
const ThreadsPreview = defineAsyncComponent(() => import('../pages/app/posts/components/ThreadsPreview.vue'));
const YoutubePreview = defineAsyncComponent(() => import('../pages/app/posts/components/YoutubePreview.vue'));
const PinterestPreview = defineAsyncComponent(() => import('../pages/app/posts/components/PinterestPreview.vue'));
const MastodonPreview = defineAsyncComponent(() => import('../pages/app/posts/components/MastodonPreview.vue'));
const BlueskyPreview = defineAsyncComponent(() => import('../pages/app/posts/components/BlueskyPreview.vue'));
const DefaultPreview = defineAsyncComponent(() => import('../pages/app/posts/components/DefaultPreview.vue'));

interface Props {
  post: PostWithAllData
}

const props = defineProps<Props>();

const { getPlatformIcon } = usePlatformIcons();

const formattedTime = computed(() => {
  if (props.post.scheduledAt) {
    return new Date(props.post.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (props.post.publishedAt) {
    return new Date(props.post.publishedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return '';
});

const previewsMap = {
  facebook: FacebookPreview,
  instagram: InstagramPreview,
  twitter: TwitterPreview,
  google: GooglePreview,
  'email-password': EmailPasswordPreview,
  linkedin: LinkedinPreview,
  tiktok: TiktokPreview,
  threads: ThreadsPreview,
  youtube: YoutubePreview,
  pinterest: PinterestPreview,
  mastodon: MastodonPreview,
  bluesky: BlueskyPreview,
  default: DefaultPreview,
};

const postMediaAssets = ref<Asset[]>(Array.isArray(props.post.mediaAssets) ? props.post.mediaAssets : []);
const postToCreate = ref<PostCreateBase & { comment: string[] }>({
  content: props.post.content,
  comment: [],
  targetPlatforms: Array.isArray(props.post.targetPlatforms) ? props.post.targetPlatforms : [props.post.targetPlatforms],
  mediaAssets: props.post.mediaAssets ? (Array.isArray(props.post.mediaAssets) ? props.post.mediaAssets : [props.post.mediaAssets]) : [],
  scheduledAt: props.post.scheduledAt,
  businessId: props.post.businessId,
  status: props.post.status,
});

</script>

<template>
  <UPopover mode="hover" modal :content="{
    align: 'center',
    side: 'left',
    sideOffset: 8
  }">
    <UButton color="neutral" variant="outline" class="p-2 w-full">
      <div class="rounded-lg  shadow-sm w-full">
        <p class="text-sm  text-wrap text-left">
          {{ post.content.slice(0, 15) }}...
        </p>
        <div class="mt-2 flex items-center justify-between">
          <div class="flex items-center space-x-1">
            <section v-for="platform in post.platformPosts">
              <Icon :name="getPlatformIcon((platform.platformPostId ?? 'facebook') as SocialMediaPlatform)" :key="platform.id" />
            </section>
          </div>
          <div class="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-clock" class="w-3 h-3" />
            <span>{{ formattedTime }}</span>
            <span class="w-2 h-2 rounded-full bg-green-500" />
          </div>
        </div>
      </div>
    </UButton>

    <template #content>
      <section class="flex flex-col gap-4 p-4">
        <div v-for="platformPost in props.post.platformPosts" :key="platformPost.id" class="border p-2 rounded-lg">
          <h3 class="font-semibold mb-2 flex items-center gap-2">
            <Icon :name="getPlatformIcon((platformPost.platformPostId ?? 'default') as SocialMediaPlatform)" />
            {{ platformPost.platformPostId }}
          </h3>
          <component :is="previewsMap[(platformPost.platformPostId || 'default') as keyof typeof previewsMap]"
            :postContent="post.content" :mediaAssets="postMediaAssets"
            :platform="(platformPost.platformPostId || 'default') as keyof SocialMediaPlatformConfigurations | 'default'"
            :post="postToCreate" />
        </div>
      </section>
    </template>
  </UPopover>
</template>
<style scoped>
.fc-h-event {
  background: transparent;
}
</style>
