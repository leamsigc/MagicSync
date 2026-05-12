<!-- Translation file -->
<i18n src="../../feeds/feeds.json"></i18n>

<!--
PostCommentsView.vue
Displays collapsible comments per platform for a published post.
Each platform section is collapsed by default; clicking "Load comments" fetches from the API.
Supports replying to individual comments.
-->
<script lang="ts" setup>
import { usePlatformIcons } from '#layers/BaseUI/app/composables/usePlatformIcons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface PlatformComment {
  id: string;
  text: string;
  authorName: string;
  authorId?: string;
  authorPicture?: string;
  createdAt: string;
  likeCount?: number;
  replyCount?: number;
  parentId?: string;
}

interface GetCommentsResponse {
  platform: string;
  postId: string;
  comments: PlatformComment[];
  hasMore: boolean;
  nextCursor?: string;
}

interface PlatformSection {
  platform: string;
  socialAccountId: string;
  status: string;
  publishedAt?: string;
  publishDetail?: string;
  isLoading: boolean;
  isExpanded: boolean;
  comments: PlatformComment[];
  hasMore: boolean;
  nextCursor?: string;
  error?: string;
  replyingTo: string | null;
  replyText: string;
  isSendingReply: boolean;
  replyError?: string;
}

const props = defineProps<{
  post: any;
}>();

const { t } = useI18n();
const { getPlatformIcon } = usePlatformIcons();
const toast = useToast();

// Build initial platform sections from post.platformPosts (only published posts)
const platformSections = ref<PlatformSection[]>([])
watch(props.post, () => {
  if (!props.post?.platformPosts) return [];

  platformSections.value = props.post.platformPosts
    .filter((pp: any) => pp.status === 'published')
    .map((pp: any) => ({
      platform: pp.platformPostId || pp.platform || 'unknown',
      socialAccountId: pp.socialAccountId,
      status: pp.status,
      publishedAt: pp.publishedAt,
      publishDetail: pp.publishDetail,
      isLoading: false,
      isExpanded: false,
      comments: [],
      hasMore: false,
      nextCursor: undefined,
      error: undefined,
      replyingTo: null,
      replyText: '',
      replyError: undefined,
      isSendingReply: false,
    }));
}, { immediate: true });

const updatePlatformSection = (section: PlatformSection) => {
  const index = platformSections.value.findIndex(s => s.socialAccountId === section.socialAccountId);
  if (index !== -1) {
    platformSections.value[index] = section;
  }
};

// Load comments for a specific platform
async function loadComments(section: PlatformSection) {

  if (section.isExpanded) {
    section.isExpanded = false;
    return;
  }

  section.isExpanded = true;
  if (section.comments.length > 0) return; // already loaded

  section.isLoading = true;
  section.error = undefined;

  try {
    const data = await $fetch<{ data: GetCommentsResponse }>(
      `/api/v1/posts/${props.post.id}/comments/${section.platform}`,
      {
        query: { limit: 25 },
      }
    );
    console.log(data);

    section.comments = data?.data?.comments || [];
    section.hasMore = data?.data?.hasMore || false;
    section.nextCursor = data?.data?.nextCursor;
  } catch (err: any) {
    section.error = err?.data?.statusMessage || err?.message || 'Failed to load comments';
  } finally {
    section.isLoading = false;
    updatePlatformSection(section);
  }
}

// Load more comments (pagination)
async function loadMore(section: PlatformSection) {
  if (!section.hasMore || !section.nextCursor) return;

  section.isLoading = true;
  try {
    const data = await $fetch<{ data: GetCommentsResponse }>(
      `/api/v1/posts/${props.post.id}/comments/${section.platform}`,
      {
        query: { limit: 25, cursor: section.nextCursor },
      }
    );

    section.comments = [...section.comments, ...(data?.data?.comments || [])];
    section.hasMore = data?.data?.hasMore || false;
    section.nextCursor = data?.data?.nextCursor;
  } catch (err: any) {
    toast.add({ title: 'Failed to load more', color: 'error' });
  } finally {
    section.isLoading = false;
    updatePlatformSection(section);
  }
}

// Start replying to a comment
function startReply(section: PlatformSection, comment: PlatformComment) {
  section.replyingTo = comment.id;
  section.replyText = '';
  section.replyError = undefined;
  updatePlatformSection(section);
}

// Cancel reply
function cancelReply(section: PlatformSection) {
  section.replyingTo = null;
  section.replyText = '';
  section.replyError = undefined;
  updatePlatformSection(section);
}

// Send reply
async function sendReply(section: PlatformSection, parentComment: PlatformComment) {
  if (!section.replyText.trim()) return;

  section.isSendingReply = true;
  section.replyError = undefined;

  try {
    await $fetch(`/api/v1/posts/${props.post.id}/comments/${section.platform}/reply`, {
      method: 'POST',
      body: {
        commentId: parentComment.id,
        replyText: section.replyText.trim(),
      },
    });

    // Optimistically add the reply to the list
    const newReply: PlatformComment = {
      id: `local-${Date.now()}`,
      text: section.replyText.trim(),
      authorName: props.post?.user?.name || 'You',
      authorPicture: props.post?.user?.image,
      createdAt: new Date().toISOString(),
      parentId: parentComment.id,
    };
    section.comments.push(newReply);
    section.replyingTo = null;
    section.replyText = '';

    toast.add({ title: t('postComments.replySent'), color: 'success' });
  } catch (err: any) {
    section.replyError = err?.data?.statusMessage || 'Failed to send reply';
  } finally {
    section.isSendingReply = false;
    updatePlatformSection(section);
  }
}

// Format relative time
function formatTime(isoString: string): string {
  if (!isoString) return '';
  return dayjs(isoString).fromNow();
}

// Group comments: top-level vs replies
function getTopLevelComments(section: PlatformSection): PlatformComment[] {
  return section.comments.filter(c => !c.parentId);
}

function getReplies(section: PlatformSection, parentId: string): PlatformComment[] {
  return section.comments.filter(c => c.parentId === parentId);
}
</script>

<template>
  <div class="space-y-4">
    <!-- Empty state -->
    <div v-if="platformSections.length === 0" class="text-center py-12">
      <UIcon name="i-heroicons-chat-bubble-oval-left" class="w-12 h-12 text-zinc-600 mx-auto mb-3" />
      <p class="text-zinc-500">{{ t('postComments.noPublishedPlatforms') }}</p>
    </div>

    <!-- Platform sections -->
    <div v-for="section in platformSections" :key="section.socialAccountId"
      class="border border-zinc-800 rounded-2xl overflow-hidden">

      <!-- Platform header (always visible) -->
      <button class="w-full flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors"
        @click="loadComments(section)">
        <div class="flex items-center gap-3">
          <UIcon :name="getPlatformIcon(section.platform as any)" class="w-5 h-5 text-zinc-400 shrink-0" />
          <div class="text-left">
            <span class="font-bold text-white capitalize">{{ section.platform }}</span>
            <span class="text-zinc-500 text-sm ml-2">{{ getTopLevelComments(section).length }} {{
              t('postComments.comments') }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UBadge :color="section.status === 'published' ? 'success' : 'warning'" variant="subtle" size="sm">
            {{ section.status }}
          </UBadge>
          <UIcon :name="section.isExpanded ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
            class="w-4 h-4 text-zinc-500 transition-transform" />
        </div>
      </button>

      <!-- Expanded content -->
      <div v-if="section.isExpanded" class="border-t border-zinc-800">

        <!-- Loading state -->
        <div v-if="section.isLoading" class="flex justify-center py-8">
          <Icon name="i-heroicons-arrow-path" size="lg" class="animate-spin text-zinc-500" />
        </div>

        <!-- Error state -->
        <div v-else-if="section.error" class="p-4">
          <div class="bg-red-950/30 border border-red-900 rounded-lg p-3 flex items-center gap-2">
            <UIcon name="i-heroicons-exclamation-circle" class="w-5 h-5 text-red-500 shrink-0" />
            <span class="text-red-400 text-sm">{{ section.error }}</span>
          </div>
          <UButton size="sm" class="mt-2" @click="loadComments(section)">
            {{ t('postComments.retry') }}
          </UButton>
        </div>

        <!-- No comments -->
        <div v-else-if="getTopLevelComments(section).length === 0" class="p-8 text-center">
          <UIcon name="i-heroicons-chat-bubble-left" class="w-10 h-10 text-zinc-700 mx-auto mb-2" />
          <p class="text-zinc-500 text-sm">{{ t('postComments.noComments') }}</p>
        </div>

        <!-- Comments list -->
        <div v-else class="divide-y divide-zinc-800/50">
          <div v-for="comment in getTopLevelComments(section)" :key="comment.id" class="p-4">
            <!-- Comment item -->
            <div class="flex gap-3">
              <UAvatar :src="comment.authorPicture || ''" :alt="comment.authorName" size="sm" class="shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-bold text-white text-sm">{{ comment.authorName }}</span>
                  <span class="text-zinc-500 text-xs">·</span>
                  <span class="text-zinc-500 text-xs">{{ formatTime(comment.createdAt) }}</span>
                </div>
                <p class="text-zinc-200 text-sm whitespace-pre-wrap">{{ comment.text }}</p>

                <!-- Comment actions -->
                <div class="flex items-center gap-3 mt-2">
                  <button class="text-zinc-500 hover:text-blue-400 text-xs flex items-center gap-1 transition-colors"
                    @click="startReply(section, comment)">
                    <UIcon name="i-heroicons-arrow-uturn-left" class="w-3 h-3" />
                    {{ t('postComments.reply') }}
                  </button>
                  <span v-if="comment.likeCount" class="text-zinc-600 text-xs">
                    <UIcon name="i-heroicons-heart" class="w-3 h-3 inline" />
                    {{ comment.likeCount }}
                  </span>
                </div>

                <!-- Reply input -->
                <div v-if="section.replyingTo === comment.id" class="mt-3">
                  <UTextarea v-model="section.replyText" :placeholder="t('postComments.replyPlaceholder')" :rows="10"
                    size="sm" class="mb-2 w-full" autoresize :disabled="section.isSendingReply" />
                  <div v-if="section.replyError" class="text-red-400 text-xs mb-2">
                    {{ section.replyError }}
                  </div>
                  <div class="flex gap-2">
                    <UButton size="xs" color="primary" :loading="section.isSendingReply"
                      :disabled="!section.replyText.trim()" @click="sendReply(section, comment)">
                      {{ t('postComments.send') }}
                    </UButton>
                    <UButton size="xs" variant="ghost" color="neutral" :disabled="section.isSendingReply"
                      @click="cancelReply(section)">
                      {{ t('postComments.cancel') }}
                    </UButton>
                  </div>
                </div>

                <!-- Nested replies -->
                <div v-if="getReplies(section, comment.id).length > 0"
                  class="mt-3 pl-3 border-l-2 border-zinc-800 space-y-3">
                  <div v-for="reply in getReplies(section, comment.id)" :key="reply.id" class="flex gap-2">
                    <UAvatar :src="reply.authorPicture || ''" :alt="reply.authorName" size="xs"
                      class="shrink-0 mt-0.5" />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-0.5">
                        <span class="font-bold text-white text-xs">{{ reply.authorName }}</span>
                        <span class="text-zinc-600 text-xs">·</span>
                        <span class="text-zinc-600 text-xs">{{ formatTime(reply.createdAt) }}</span>
                      </div>
                      <p class="text-zinc-300 text-xs whitespace-pre-wrap">{{ reply.text }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Load more -->
          <div v-if="section.hasMore" class="p-3 text-center">
            <UButton variant="ghost" size="sm" color="neutral" :loading="section.isLoading" @click="loadMore(section)">
              {{ t('postComments.loadMore') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
