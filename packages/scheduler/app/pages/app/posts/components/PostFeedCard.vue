<script lang="ts" setup>
/**
 *
 * Component Description: X-style feed card for a post.
 * Renders posts one after another with platform badges showing
 * where the post was (or will be) published.
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 */
import type { PostWithAllData } from '#layers/BaseDB/db/schema';
import { usePlatformIcons, type SocialMediaPlatform } from '#layers/BaseUI/app/composables/usePlatformIcons';
import dayjs from 'dayjs';

const props = defineProps<{
  post: PostWithAllData;
}>();

const router = useRouter();
const showComments = ref(false);
const { getPlatformIcon } = usePlatformIcons();

const openPost = () => {
  router.push(`/app/posts/feeds/${props.post.id}`);
};

const platformIcon = (id?: string | null) => getPlatformIcon((id || 'facebook') as SocialMediaPlatform);

const statusColor = (status?: string | null) => {
  switch (status) {
    case 'published': return 'success' as const
    case 'pending': return 'warning' as const
    case 'failed': return 'error' as const
    default: return 'neutral' as const
  }
};

const formattedTime = computed(() =>
  dayjs(props.post.scheduledAt || props.post.createdAt).format('h:mm A · MMM D, YYYY')
);

const comments = computed(() => props.post.platformContent?.comment || []);
</script>

<template>
  <article class="p-4 sm:p-5 hover:bg-accent/50 transition-colors cursor-pointer" @click="openPost">
    <div class="flex gap-3">
      <UAvatar :src="post.user.image || undefined" :alt="post.user.name || 'User'" size="md"
        class="shrink-0 ring-1 ring-border" />

      <div class="flex-1 min-w-0">
        <!-- Header -->
        <div class="flex items-center gap-1.5 text-sm min-w-0">
          <span class="font-bold text-highlighted truncate">{{ post.user.name || 'User' }}</span>
          <span class="text-muted truncate">{{ post.user.firstName ? `@${post.user.firstName}` : '' }}</span>
          <span class="text-muted">·</span>
          <time class="text-muted hover:underline shrink-0" :datetime="post.scheduledAt || post.createdAt">
            {{ formattedTime }}
          </time>
        </div>

        <!-- Content -->
        <p class="text-default whitespace-pre-wrap text-[15px] leading-relaxed mt-0.5 wrap-break-word">
          {{ post.content }}
        </p>

        <!-- Media -->
        <div v-if="post.assets?.length" class="mt-3 rounded-2xl overflow-hidden ">
          <div class="grid grid-cols-1 gap-px bg-border">
            <img v-for="(asset, index) in post.assets" :key="index" :src="asset.url" alt=""
              class="w-full max-h-96 object-cover bg-elevated" loading="lazy">
          </div>
        </div>

        <!-- Platforms: where this post goes -->
        <div v-if="post.platformPosts?.length" class="flex flex-wrap items-center gap-1.5 mt-3">
          <UChip v-for="platform in post.platformPosts" :key="platform.id" :color="statusColor(platform.status)"
            size="sm" :text="''" inset>
            <UTooltip :text="`${platform.platformPostId || 'platform'} — ${platform.status || 'unknown'}`">
              <span class="inline-flex items-center justify-center size-6 rounded-md bg-elevated ">
                <UIcon :name="platformIcon(platform.platformPostId)" class="size-4" />
              </span>
            </UTooltip>
          </UChip>
        </div>

        <!-- Action bar -->
        <div class="flex items-center gap-1 mt-3 -ml-2 text-muted">
          <UButton icon="i-heroicons-chat-bubble-oval-left-ellipsis" color="neutral" variant="ghost" size="sm"
            :label="comments.length ? String(comments.length) : ''" @click.stop="showComments = !showComments" />
          <UButton icon="i-heroicons-arrow-top-right-on-square" color="neutral" variant="ghost" size="sm"
            label="Details" @click.stop="openPost" />
        </div>

        <!-- Comments -->
        <div v-if="showComments && comments.length" class="mt-3  pt-3 space-y-3" @click.stop>
          <div v-for="(comment, index) in comments" :key="index" class="flex gap-3">
            <UAvatar :src="post.user.image || undefined" :alt="post.user.name || 'User'" size="xs"
              class="shrink-0 opacity-70 mt-0.5" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 text-sm">
                <span class="font-semibold text-highlighted">{{ post.user.name || 'User' }}</span>
                <span class="text-muted">{{ formattedTime }}</span>
              </div>
              <p class="text-default whitespace-pre-wrap text-sm leading-relaxed mt-0.5 break-words">
                {{ comment }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped></style>
