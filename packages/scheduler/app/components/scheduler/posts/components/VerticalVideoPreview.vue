<!--  Translation file -->
<i18n src="./VerticalVideoPreview.json"></i18n>
<script lang="ts" setup>
import type { Asset, PostCreateBase, User } from '#layers/BaseDB/db/schema';
import type { PostFormat } from '../../../../composables/usePlatformConfiguration';

interface Props {
    postContent: string;
    mediaAssets: Asset[];
    platform: string;
    post: PostCreateBase;
    format: PostFormat;
}

const props = defineProps<Props>();

const { t } = useI18n();

const user = useState<User | null>('auth:user');

const firstAsset = computed(() => props.mediaAssets[0]);

const isVideoAsset = computed(() => firstAsset.value?.mimeType?.startsWith('video/') ?? false);

const handleName = computed(() => user.value?.name || t('defaultHandle'));

const soundLabel = computed(() => t('originalSound', { name: user.value?.name || t('defaultBrand') }));

/**
 * Firefox cannot decode some phone codecs (HEVC) and blocks unmuted autoplay,
 * either of which leaves the canvas black with no subsequent event to recover
 * from — except the element's own `error`, which swaps the player for an
 * honest fallback instead of a dead rectangle.
 */
const videoFailed = ref(false);

function onVideoError() {
  videoFailed.value = true;
}

watch(() => firstAsset.value?.url, () => {
  videoFailed.value = false;
});

const formattedContent = computed(() => {
    const parts = props.postContent.split(/(\s+)/);
    return parts.map(part => {
        if (part.startsWith('#')) return { text: part, type: 'hashtag' };
        if (part.startsWith('http')) return { text: part, type: 'link' };
        return { text: part, type: 'text' };
    });
});
</script>

<template>
    <div class=" w-full h-full bg-black text-white flex flex-col justify-end pb-20">
        <!-- Real media fills the canvas; an explicit empty state replaces the
          old black void so a text-only reel never reads as a broken player -->
        <div class="absolute inset-0 overflow-hidden bg-zinc-900 flex items-center justify-center">
            <template v-if="firstAsset">
                <!-- muted + playsinline + preload: autoplay is blocked with
                  sound on every browser, and without preloaded metadata
                  Firefox never paints even the first frame -->
                <video v-if="isVideoAsset && !videoFailed"
                    class="w-full h-full object-cover" :src="firstAsset.url" autoplay muted loop playsinline
                    preload="metadata" controls @error="onVideoError" />
                <img v-else-if="!isVideoAsset" :src="firstAsset.url" class="w-full h-full object-cover" :alt="t('mediaAlt')" />
                <div v-else class="flex flex-col items-center gap-3 px-8 text-center">
                    <UIcon name="i-lucide-video-off" class="size-12 text-zinc-500" aria-hidden="true" />
                    <p class="text-sm font-semibold text-zinc-200">{{ t('unplayableTitle') }}</p>
                    <p class="text-xs text-zinc-400">{{ t('unplayableBody') }}</p>
                </div>
            </template>
            <div v-else class="flex flex-col items-center gap-3 px-8 text-center">
                <UIcon name="i-lucide-clapperboard" class="size-12 text-zinc-500" aria-hidden="true" />
                <p class="text-sm font-semibold text-zinc-200">{{ t('emptyTitle') }}</p>
                <p class="text-xs text-zinc-400">{{ t('emptyBody') }}</p>
            </div>
        </div>

        <!-- Bottom scrim keeps the caption legible over bright media without
          dimming the whole canvas the way the old overlay did -->
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 to-transparent" aria-hidden="true" />

        <div class="absolute bottom-10 right-0 z-10 px-4 flex justify-between items-end">
            <div class="flex-1 mr-26">
                <div class="flex items-center gap-2 mb-2">
                    <UAvatar :src="user?.image || ''" :alt="handleName" size="sm" />
                    <span class="font-bold text-sm drop-shadow-md">@{{ handleName }}</span>
                </div>
                <div class="text-sm drop-shadow-md mb-2 line-clamp-3">
                    <template v-for="(part, i) in formattedContent" :key="i">
                        <span v-if="part.type === 'hashtag'" class="text-blue-400 font-semibold">{{ part.text }}</span>
                        <span v-else-if="part.type === 'link'" class="text-blue-400 underline">{{ part.text }}</span>
                        <span v-else>{{ part.text }}</span>
                    </template>
                </div>
                <div class="flex items-center gap-2 text-xs opacity-90">
                    <Icon name="lucide:music-2" class="w-3 h-3 animate-spin" aria-hidden="true" />
                    <span>{{ soundLabel }}</span>
                </div>
            </div>

            <!-- Icon-only rail: an unsent reel has no likes, comments or
              shares, and the old hardcoded 84.2K / 1024 invented them -->
            <div class="flex flex-col gap-4 items-center pb-2" aria-hidden="true">
                <div class="p-2 bg-black/40 rounded-full size-8">
                    <Icon name="lucide:heart" class="fill-white" />
                </div>
                <div class="p-2 bg-black/40 rounded-full size-8">
                    <Icon name="lucide:message-circle" class="fill-white" />
                </div>
                <div class="p-2 bg-black/40 rounded-full size-8">
                    <Icon name="lucide:share-2" class="fill-white" />
                </div>
                <div v-if="platform === 'tiktok'"
                    class="mt-2 w-10 h-10 rounded-full border-4 border-zinc-800 bg-zinc-700 overflow-hidden animate-spin">
                    <Icon name="lucide:disc" class="w-full h-full p-1" />
                </div>
            </div>
        </div>
    </div>
</template>
