<i18n src="../../posts.json"></i18n>

<script lang="ts" setup>
/**
 * Platform Auto-Format: analyzes the master post against each selected
 * platform's character limits and generates per-platform overrides.
 * Platforms with short limits (twitter, bluesky, threads...) get split into a
 * thread: first chunk becomes the post, remaining chunks become comments.
 * Long-form platforms (facebook, wordpress...) are left as a single post.
 */
import { platformConfigurations, type SocialMediaPlatformConfigurations } from '#layers/BaseScheduler/shared/platformConstants';
import { buildPlatformSplit } from '#layers/BaseScheduler/shared/threadSplitter';
import type { PlatformContentOverride } from '../../composables/usePlatformSettings';

type PlatformId = keyof SocialMediaPlatformConfigurations;

const props = defineProps<{
  platforms: string[];
  content: string;
}>();

const emit = defineEmits<{
  apply: [overrides: Record<string, PlatformContentOverride>];
}>();

const { t } = useI18n();
const toast = useToast();

interface PlatformFormatStatus {
  platform: PlatformId;
  label: string;
  maxLength: number;
  contentLength: number;
  fits: boolean;
  /** undefined when platform cannot host thread comments */
  thread?: { parts: number; comments: number };
  canThread: boolean;
}

const uniquePlatforms = computed<PlatformId[]>(() => [...new Set(props.platforms)] as PlatformId[]);

const statuses = computed<PlatformFormatStatus[]>(() =>
  uniquePlatforms.value.map((platform) => {
    const config = platformConfigurations[platform];
    if (!config) {
      return {
        platform,
        label: platform,
        maxLength: Number.POSITIVE_INFINITY,
        contentLength: props.content.length,
        fits: true,
        canThread: false,
      };
    }
    const split = buildPlatformSplit(props.content, config.maxPostLength);
    return {
      platform,
      label: platform.charAt(0).toUpperCase() + platform.slice(1),
      maxLength: config.maxPostLength,
      contentLength: props.content.length,
      fits: split.fits,
      thread: split.comments.length > 0 ? { parts: 1 + split.comments.length, comments: split.comments.length } : undefined,
      canThread: config.supportsComments,
    };
  })
);

const needsAttention = computed(() => statuses.value.some(s => !s.fits));
const hasContent = computed(() => props.content.trim().length > 0);

const buildOverride = (status: PlatformFormatStatus): PlatformContentOverride | null => {
  const config = platformConfigurations[status.platform];
  if (!config) return null;

  const split = buildPlatformSplit(props.content, config.maxPostLength);
  if (split.fits) return null; // nothing to override

  if (split.comments.length > 0 && status.canThread) {
    return { content: split.content, comments: [...split.comments] };
  }
  // Cannot thread: truncate to the platform limit instead
  return { content: `${props.content.slice(0, Math.max(0, config.maxPostLength - 3)).trimEnd()}...` };
};

const applyAll = () => {
  const overrides: Record<string, PlatformContentOverride> = {};
  for (const status of statuses.value) {
    const override = buildOverride(status);
    if (override) overrides[status.platform] = override;
  }
  if (Object.keys(overrides).length === 0) {
    toast.add({ title: t('autoFormat.nothingToApply'), icon: 'i-heroicons-information-circle', color: 'neutral' });
    return;
  }
  emit('apply', overrides);
  toast.add({
    title: t('autoFormat.appliedTitle'),
    description: t('autoFormat.appliedDescription', { count: Object.keys(overrides).length }),
    icon: 'i-heroicons-scissors',
    color: 'success',
  });
};

const applyOne = (status: PlatformFormatStatus) => {
  const override = buildOverride(status);
  if (!override) return;
  emit('apply', { [status.platform]: override });
  toast.add({
    title: t('autoFormat.appliedTitle'),
    description: t('autoFormat.appliedOne', { platform: status.label }),
    icon: 'i-heroicons-scissors',
    color: 'success',
  });
};
</script>

<template>
  <UCard class="border-dashed">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-scissors" class="w-5 h-5 text-indigo-400" />
        <h4 class="text-sm font-semibold">{{ t('autoFormat.title') }}</h4>
      </div>
      <UButton
v-if="needsAttention && hasContent" size="xs" color="primary" icon="i-heroicons-sparkles"
        @click="applyAll">
        {{ t('autoFormat.applyAll') }}
      </UButton>
    </div>

    <p class="mt-1 text-xs text-zinc-500">{{ t('autoFormat.description') }}</p>

    <div v-if="!hasContent" class="mt-3 text-xs text-zinc-600 italic">
      {{ t('autoFormat.emptyState') }}
    </div>

    <div v-else-if="uniquePlatforms.length === 0" class="mt-3 text-xs text-zinc-600 italic">
      {{ t('autoFormat.noPlatforms') }}
    </div>

    <ul v-else class="mt-3 space-y-2">
      <li
v-for="status in statuses" :key="status.platform"
        class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-default/50 px-3 py-2">
        <UIcon
:name="status.fits ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'"
          :class="status.fits ? 'text-green-500' : 'text-amber-400'" class="w-4 h-4 shrink-0" />
        <span class="text-sm font-medium min-w-24">{{ status.label }}</span>

        <span class="text-xs" :class="status.fits ? 'text-zinc-500' : 'text-amber-400'">
          {{ status.contentLength }}/{{ status.maxLength }}
        </span>

        <UBadge v-if="!status.fits && status.canThread && status.thread" color="info" variant="subtle" size="sm">
          {{ t('autoFormat.threadBadge', { parts: status.thread.parts }) }}
        </UBadge>
        <UBadge v-else-if="!status.fits && !status.canThread" color="warning" variant="subtle" size="sm">
          {{ t('autoFormat.truncateBadge') }}
        </UBadge>
        <UBadge v-else color="success" variant="subtle" size="sm">
          {{ t('autoFormat.fitsBadge') }}
        </UBadge>

        <UButton
v-if="!status.fits" size="xs" variant="ghost" color="primary" class="ml-auto"
          @click="() => applyOne(status)">
          {{ t('autoFormat.apply') }}
        </UButton>
      </li>
    </ul>
  </UCard>
</template>

<style scoped></style>
