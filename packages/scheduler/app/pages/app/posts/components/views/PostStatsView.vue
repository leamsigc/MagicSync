<!-- Translation file -->
<i18n src="../../feeds/feeds.json"></i18n>

<!--
PostStatsView.vue
Displays post insights/analytics per platform for a published post.
Each platform section is collapsed by default; clicking "Load stats" fetches from the API.
-->
<script lang="ts" setup>
import { usePlatformIcons } from '#layers/BaseUI/app/composables/usePlatformIcons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface PostStat {
  label: string;
  value: number | string;
}

interface PlatformStatsData {
  platform: string;
  socialAccountId: string;
  status: string;
  publishedAt?: string;
  stats?: PostStat[];
  cached?: boolean;
  updatedAt?: string;
  error?: string;
}

interface PlatformSection {
  platform: string;
  socialAccountId: string;
  status: string;
  publishedAt?: string;
  isLoading: boolean;
  isExpanded: boolean;
  stats?: PostStat[];
  cached?: boolean;
  updatedAt?: string;
  error?: string;
}

const props = defineProps<{
  post: any;
}>();

const { t } = useI18n();
const { getPlatformIcon } = usePlatformIcons();
const toast = useToast();

const platformSections = ref<PlatformSection[]>([]);

watch(props.post, () => {
  if (!props.post?.platformPosts) return;

  platformSections.value = props.post.platformPosts
    .filter((pp: any) => pp.status === 'published')
    .map((pp: any) => ({
      platform: pp.platformPostId || pp.platform || 'unknown',
      socialAccountId: pp.socialAccountId,
      status: pp.status,
      publishedAt: pp.publishedAt,
      isLoading: false,
      isExpanded: false,
      stats: undefined,
      cached: undefined,
      updatedAt: undefined,
      error: undefined,
    }));
}, { immediate: true });

const updatePlatformSection = (section: PlatformSection) => {
  const index = platformSections.value.findIndex(s => s.socialAccountId === section.socialAccountId);
  if (index !== -1) {
    platformSections.value[index] = section;
  }
};

async function loadStats(section: PlatformSection) {
  if (section.isExpanded) {
    section.isExpanded = false;
    return;
  }

  section.isExpanded = true;
  if (section.stats) return;

  section.isLoading = true;
  section.error = undefined;

  try {
    const data = await $fetch<{ data: any; cached?: boolean; updatedAt?: string }>(
      `/api/v1/posts/${props.post.id}/stats/${section.platform}`
    );

    section.stats = data?.data || [];
    section.cached = data?.cached || false;
    section.updatedAt = data?.updatedAt;

    if (section.cached) {
      toast.add({ title: t('postStats.loadedFromCache'), color: 'success', icon: 'i-heroicons-clock' });
    }
  } catch (err: any) {
    section.error = err?.data?.statusMessage || err?.message || 'Failed to load stats';
  } finally {
    section.isLoading = false;
    updatePlatformSection(section);
  }
}

function formatTime(isoString: string): string {
  if (!isoString) return '';
  return dayjs(isoString).fromNow();
}

function formatNumber(value: number | string | undefined): string {
  if (value === undefined || value === null) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  return num.toLocaleString();
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="platformSections.length === 0" class="text-center py-12">
      <UIcon name="i-heroicons-chart-bar" class="w-12 h-12 text-zinc-600 mx-auto mb-3" />
      <p class="text-zinc-500">{{ t('postStats.noPublishedPlatforms') }}</p>
    </div>

    <div v-for="section in platformSections" :key="section.socialAccountId"
      class="border border-zinc-800 rounded-2xl overflow-hidden">

      <button class="w-full flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors"
        @click="loadStats(section)">
        <div class="flex items-center gap-3">
          <UIcon :name="getPlatformIcon(section.platform as any)" class="w-5 h-5 text-zinc-400 shrink-0" />
          <div class="text-left">
            <span class="font-bold text-white capitalize">{{ section.platform }}</span>
            <span v-if="section.stats" class="text-zinc-500 text-sm ml-2">
              · {{ section.stats.length }} {{ t('postStats.metrics') }}
            </span>
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

      <div v-if="section.isExpanded" class="border-t border-zinc-800">

        <div v-if="section.isLoading" class="flex justify-center py-8">
          <Icon name="i-heroicons-arrow-path" size="lg" class="animate-spin text-zinc-500" />
        </div>

        <div v-else-if="section.error" class="p-4">
          <div class="bg-red-950/30 border border-red-900 rounded-lg p-3 flex items-center gap-2">
            <UIcon name="i-heroicons-exclamation-circle" class="w-5 h-5 text-red-500 shrink-0" />
            <span class="text-red-400 text-sm">{{ section.error }}</span>
          </div>
          <UButton size="sm" class="mt-2" @click="loadStats(section)">
            {{ t('postStats.retry') }}
          </UButton>
        </div>

        <div v-else-if="section.stats && section.stats.length > 0" class="p-4 space-y-3">
          <div class="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span>{{ t('postStats.lastUpdated') }}: {{ formatTime(section.updatedAt || '') }}</span>
            <UBadge v-if="section.cached" color="warning" variant="subtle" size="xs">
              {{ t('postStats.cached') }}
            </UBadge>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div v-for="stat in section.stats" :key="stat.label"
              class="bg-zinc-900/50 rounded-xl p-3 flex flex-col gap-1">
              <span class="text-zinc-500 text-xs truncate">{{ stat.label }}</span>
              <span class="text-white text-xl font-bold">{{ formatNumber(stat.value) }}</span>
            </div>
          </div>

          <div v-if="!section.cached" class="flex items-center justify-between text-xs text-zinc-600 mt-2">
            <UIcon name="i-heroicons-arrow-path" class="w-3 h-3" />
            <span>{{ t('postStats.freshData') }}</span>
          </div>
        </div>

        <div v-else class="p-8 text-center">
          <UIcon name="i-heroicons-chart-bar" class="w-10 h-10 text-zinc-700 mx-auto mb-2" />
          <p class="text-zinc-500 text-sm">{{ t('postStats.noStats') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
