<script lang="ts" setup>
import type { Asset, PostCreateBase } from '#layers/BaseDB/db/schema';
import type { PlatformConfig, SocialMediaPlatformConfigurations, PostFormat } from '../composables/usePlatformConfiguration';

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
const VerticalVideoPreview = defineAsyncComponent(() => import('./VerticalVideoPreview.vue'));

interface Props {
  postContent: string;
  mediaAssets: Asset[];
  platform: keyof SocialMediaPlatformConfigurations;
  post: PostCreateBase;
  currentPlatformConfig: PlatformConfig;
  format?: PostFormat;
}

const props = withDefaults(defineProps<Props>(), {
  format: 'post'
});

const emit = defineEmits<{
  (e: 'update:format', format: PostFormat): void;
}>();

const selectedFormat = ref<PostFormat>(props.format);

watch(() => props.format, (newFormat) => {
  selectedFormat.value = newFormat;
});

const supportedFormats = computed(() => {
  return props.currentPlatformConfig?.supportedFormats || ['post'];
});

const isVerticalVideo = computed(() => {
  return selectedFormat.value === 'reel' || selectedFormat.value === 'short' || props.platform === 'tiktok';
});

const handleFormatChange = (format: PostFormat) => {
  selectedFormat.value = format;
  emit('update:format', format);
};

const platformConfig = computed(() => {
  const configs: Record<string, { logo: string; bgColor: string; textColor: string }> = {
    instagram: { logo: 'Instagram', bgColor: '', textColor: 'dark:text-zinc-100' },
    twitter: { logo: '𝕏', bgColor: 'bg-black', textColor: 'dark:text-white' },
    x: { logo: '𝕏', bgColor: 'bg-black', textColor: 'dark:text-white' },
    facebook: { logo: 'facebook', bgColor: '', textColor: 'dark:text-zinc-100' },
    linkedin: { logo: 'LinkedIn', bgColor: '', textColor: 'dark:text-zinc-100' },
    tiktok: { logo: 'TikTok', bgColor: 'bg-black', textColor: 'dark:text-white' },
    threads: { logo: 'Threads', bgColor: '', textColor: 'dark:text-zinc-100' },
    bluesky: { logo: 'Bluesky', bgColor: '', textColor: 'dark:text-zinc-100' },
    youtube: { logo: 'YouTube', bgColor: '', textColor: 'dark:text-zinc-100' },
    default: { logo: 'Preview', bgColor: '', textColor: 'dark:text-zinc-100' },
  };

  if (isVerticalVideo.value) {
    return { ...configs[props.platform] || configs.default, bgColor: 'bg-black' };
  }

  return configs[props.platform] || configs.default;
});

const currentPreviewComponent = computed(() => {
  if (isVerticalVideo.value) {
    return VerticalVideoPreview;
  }

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

const formatLabels: Record<PostFormat, string> = {
  post: 'POST',
  reel: 'REEL',
  story: 'STORY',
  short: 'SHORT'
};
</script>

<template>
  <div class="flex flex-col items-center">
    <div v-if="supportedFormats.length > 1"
      class="mb-4 w-full md:max-w-[320px] flex items-center justify-between bg-zinc-900/80 p-2 rounded-xl border border-white/10 backdrop-blur shadow-xl">
      <div class="flex items-center gap-2">
        <Icon :name="`logos:${platform}`" class="w-5 h-5" v-if="platform !== 'default'" />
        <span class="text-sm font-bold text-zinc-200">{{ platformConfig?.logo || platform }}</span>
      </div>
      <div class="md:flex bg-zinc-800 rounded-lg p-1 gap-1 hidden">
        <button v-for="fmt in supportedFormats" :key="fmt" @click="handleFormatChange(fmt)" :class="[
          'px-3 py-1 text-[10px] font-bold uppercase rounded transition-all',
          selectedFormat === fmt
            ? 'bg-zinc-600 text-white shadow-sm'
            : 'text-zinc-500 hover:text-zinc-300'
        ]">

          {{ formatLabels[fmt] }}
        </button>
      </div>
    </div>

    <PhoneShell :platform-config="platformConfig as any">
      <component :is="currentPreviewComponent" :postContent="postContent" :mediaAssets="mediaAssets"
        :platform="platform" :post="post" :format="selectedFormat" />
    </PhoneShell>
  </div>
</template>
