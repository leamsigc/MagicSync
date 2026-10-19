<!-- Translation file -->
<i18n src="#site/app/pages/app/posts/feeds/feeds.json"></i18n>

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
  history?: any[];
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
  history?: any[];
}

const props = defineProps<{
  post: any;
  autoLoad?: boolean;
}>();

const { t } = useI18n();
const { getPlatformIcon } = usePlatformIcons();
const toast = useToast();

const platformSections = ref<PlatformSection[]>([]);

async function loadStats(section: PlatformSection, forceRefresh = false) {
  if (!forceRefresh && section.isExpanded && section.stats) return;

  section.isExpanded = true;
  section.isLoading = true;
  section.error = undefined;
  section.cached = false;

  try {
    const data = await $fetch<{ data: any; cached?: boolean; updatedAt?: string }>(
      `/api/v1/posts/${props.post.id}/stats/${section.platform}`,
      { query: { accountId: section.socialAccountId, ...(forceRefresh ? { refresh: 1 } : {}) } }
    );

    const raw = data?.raw;
    const metrics = data?.data;
    let statsArr: any[] = [];
    if (Array.isArray(raw) && raw.length > 0) {
      statsArr = raw.map((r: any) => ({ label: r.label ?? r.key, value: r.value ?? r.count ?? 0 }));
    } else if (metrics && typeof metrics === 'object') {
      statsArr = Object.entries(metrics).map(([k, v]) => ({ label: k, value: v }));
    }
    section.stats = statsArr;
    section.cached = data?.cached || false;
    section.updatedAt = data?.updatedAt;
    section.history = data?.history || [];

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

function toggleSection(section: PlatformSection) {
  if (section.isExpanded) {
    section.isExpanded = false;
    return;
  }
  loadStats(section);
}

function loadAllSections() {
  platformSections.value.forEach((section) => {
    if (!section.stats) loadStats(section);
  });
}

watch(() => props.autoLoad, (active) => {
  if (active) loadAllSections();
});

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

function formatTime(isoString: string): string {
  if (!isoString) return '';
  return dayjs(isoString).fromNow();
}

function sectionChartData(section: PlatformSection): any[] {
  if (!section.history || section.history.length === 0) return [];
  return section.history
    .filter((h: any) => h.status === 'success')
    .map((h: any) => ({
      date: h.collectedAt ? new Date(h.collectedAt).toLocaleDateString() : '',
      total: h.metrics?.total ?? 0,
      comments: h.metrics?.comments ?? 0,
      likes: h.metrics?.likes ?? 0,
    }))
    .reverse();
}

function sectionChartOptions(section: PlatformSection): any {
  const data = sectionChartData(section);
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['total', 'comments', 'likes'] },
    xAxis: { type: 'category', data: data.map((d: any) => d.date) },
    yAxis: { type: 'value' },
    series: [
      { name: 'total', type: 'line', data: data.map((d: any) => d.total) },
      { name: 'comments', type: 'line', data: data.map((d: any) => d.comments) },
      { name: 'likes', type: 'line', data: data.map((d: any) => d.likes) },
    ],
  };
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
        @click="toggleSection(section)">
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
          <ULink
            class="text-zinc-400 hover:text-white transition-colors"
            :title="t('postStats.refresh')"
            :aria-label="t('postStats.refresh')"
            @click.stop="loadStats(section, true)"
          >
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" />
          </ULink>
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

          <div v-if="sectionChartData(section).length > 1" class="mt-4">
            <BaseChart
              title="History"
              description="Metric history"
              icon="i-lucide-line-chart"
              :chart-options="sectionChartOptions(section)"
            />
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
