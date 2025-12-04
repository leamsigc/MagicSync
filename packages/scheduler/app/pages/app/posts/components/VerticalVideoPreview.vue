<script lang="ts" setup>
import type { Asset, PostCreateBase, User } from '#layers/BaseDB/db/schema';
import type { PostFormat } from '../composables/usePlatformConfiguration';

interface Props {
    postContent: string;
    mediaAssets: Asset[];
    platform: string;
    post: PostCreateBase;
    format: PostFormat;
}

const props = defineProps<Props>();

const user = useState<User | null>('auth:user');

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
        <div class="absolute inset-0 bg-zinc-800 flex items-center justify-center">
            <template v-if="mediaAssets.length > 0">
                <video v-if="mediaAssets[0]?.mimeType?.startsWith('video/')"
                    class="w-full h-full object-cover opacity-60" :src="mediaAssets[0]?.url" muted />
                <img v-else :src="mediaAssets[0]?.url" class="w-full h-full object-cover opacity-60" alt="Background" />
            </template>
            <div v-else class="text-center opacity-50">
                <div class="text-6xl mb-2">▶</div>
                <span class="uppercase font-bold tracking-widest text-xs">Video Content</span>
            </div>
        </div>

        <div class="absolute bottom-10 right-0 z-10 px-4 flex justify-between items-end">
            <div class="flex-1 mr-26">
                <div class="flex items-center gap-2 mb-2">
                    <UAvatar :src="user?.image || ''" :alt="user?.name || 'User'" size="sm" />
                    <span class="font-bold text-sm drop-shadow-md">@{{ user?.name || 'yourbrand' }}</span>
                </div>
                <div class="text-sm drop-shadow-md mb-2 line-clamp-3">
                    <template v-for="(part, i) in formattedContent" :key="i">
                        <span v-if="part.type === 'hashtag'" class="text-blue-400 font-semibold">{{ part.text }}</span>
                        <span v-else-if="part.type === 'link'" class="text-blue-400 underline">{{ part.text }}</span>
                        <span v-else>{{ part.text }}</span>
                    </template>
                </div>
                <div class="flex items-center gap-2 text-xs opacity-90">
                    <Icon name="lucide:music-2" class="w-3 h-3 animate-spin" />
                    <span>Original Sound - {{ user?.name || 'Your Brand' }}</span>
                </div>
            </div>

            <div class="flex flex-col gap-4 items-center pb-2">
                <div class="flex flex-col items-center gap-1">
                    <div class="p-2 bg-black/40 rounded-full size-8">
                        <Icon name="lucide:heart" class="fill-white" />
                    </div>
                    <span class="text-xs font-bold">84.2K</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                    <div class="p-2 bg-black/40 rounded-full size-8">
                        <Icon name="lucide:message-circle" class="fill-white" />
                    </div>
                    <span class="text-xs font-bold">1024</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                    <div class="p-2 bg-black/40 rounded-full size-8">
                        <Icon name="lucide:share-2" class="fill-white" />
                    </div>
                    <span class="text-xs font-bold">Share</span>
                </div>
                <div v-if="platform === 'tiktok'"
                    class="mt-2 w-10 h-10 rounded-full border-4 border-zinc-800 bg-zinc-700 overflow-hidden animate-spin">
                    <Icon name="lucide:disc" class="w-full h-full p-1" />
                </div>
            </div>
        </div>
    </div>
</template>
