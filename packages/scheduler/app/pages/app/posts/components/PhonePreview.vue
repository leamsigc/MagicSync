<script lang="ts" setup>
/**
 * Component Description: Wrapper component that renders the appropriate platform preview within a phone shell
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.2
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { Asset, PostCreateBase } from '#layers/BaseDB/db/schema';
import type { SocialMediaPlatformConfigurations } from '../composables/usePlatformConfiguration';

const FacebookPreview = defineAsyncComponent(() => import('./FacebookPreview.vue'));
const InstagramPreview = defineAsyncComponent(() => import('./InstagramPreview.vue'));
const TwitterPreview = defineAsyncComponent(() => import('./TwitterPreview.vue'));
const GooglePreview = defineAsyncComponent(() => import('./GooglePreview.vue'));
const EmailPasswordPreview = defineAsyncComponent(() => import('./EmailPasswordPreview.vue'));
const LinkedinPreview = defineAsyncComponent(() => import('./LinkedinPreview.vue'));
const TiktokPreview = defineAsyncComponent(() => import('./TiktokPreview.vue'));
const ThreadsPreview = defineAsyncComponent(() => import('./ThreadsPreview.vue'));
const YoutubePreview = defineAsyncComponent(() => import('./YoutubePreview.vue'));
const PinterestPreview = defineAsyncComponent(() => import('./PinterestPreview.vue'));
const MastodonPreview = defineAsyncComponent(() => import('./MastodonPreview.vue'));
const BlueskyPreview = defineAsyncComponent(() => import('./BlueskyPreview.vue'));
const DefaultPreview = defineAsyncComponent(() => import('./DefaultPreview.vue'));


interface Props {
  postContent: string;
  mediaAssets: Asset[];
  platform: keyof SocialMediaPlatformConfigurations;
  post: PostCreateBase;
}

const props = defineProps<Props>();

const platformConfig = computed(() => {
  const configs: Record<string, { logo: string; bgColor: string; textColor: string }> = {
    instagram: { logo: 'Instagram', bgColor: '', textColor: 'text-zinc-100' },
    twitter: { logo: '𝕏', bgColor: 'bg-black', textColor: 'text-white' },
    x: { logo: '𝕏', bgColor: 'bg-black', textColor: 'text-white' },
    facebook: { logo: 'facebook', bgColor: '', textColor: 'text-zinc-100' },
    linkedin: { logo: 'LinkedIn', bgColor: '', textColor: 'text-zinc-100' },
    tiktok: { logo: 'TikTok', bgColor: '', textColor: 'text-white' },
    threads: { logo: 'Threads', bgColor: '', textColor: 'text-zinc-100' },
    bluesky: { logo: 'Bluesky', bgColor: '', textColor: 'text-zinc-100' },
    default: { logo: 'Preview', bgColor: '', textColor: 'text-zinc-100' },
  };
  return configs[props.platform] || configs.default;
});

const currentPreviewComponent = computed(() => {
  switch (props.platform) {
    case 'facebook':
      return FacebookPreview;
    case 'instagram':
      return InstagramPreview;
    case 'twitter':
    case 'x':
      return TwitterPreview;
    case 'linkedin':
      return LinkedinPreview;
    case 'tiktok':
      return TiktokPreview;
    case 'threads':
      return ThreadsPreview;
    case 'bluesky':
      return BlueskyPreview;
    case 'google':
      return GooglePreview;
    case 'email-password':
      return EmailPasswordPreview;
    case 'youtube':
      return YoutubePreview;
    case 'pinterest':
      return PinterestPreview;
    case 'mastodon':
      return MastodonPreview;
    default:
      return DefaultPreview;
  }
});
</script>

<template>
  <PhoneShell :platform-config="platformConfig">
    <component :postContent="postContent" :mediaAssets="mediaAssets" :platform="platform" :post="post"
      :is="currentPreviewComponent" />
    <template #footer>

    </template>
  </PhoneShell>
</template>
