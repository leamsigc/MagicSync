<!--  Translation file -->
<i18n src="#site/app/pages/app/media/index.json"></i18n>

<script lang="ts" setup>
/**
 * Media summary: the storage card on the left half, the four counters as a
 * compact 2×2 grid on the right.
 *
 * The counters are filters too — clicking "Images" applies the image filter
 * instead of only being decorative.
 */
type StorageUsage = {
  formattedSize: string
  totalSize: number
  count: number
}

type StorageBreakdown = {
  images: number
  videos: number
  documents: number
  other: number
}

type AssetStats = {
  total: number
  images: number
  videos: number
  documents: number
}

type AssetFilterType = 'all' | 'image' | 'video' | 'document'

const props = defineProps<{
  storageUsage: StorageUsage
  storageBreakdown: StorageBreakdown
  assetStats: AssetStats
  activeType?: AssetFilterType
}>()

const emit = defineEmits<{
  upload: []
  createFolder: []
  selectType: [type: AssetFilterType]
}>()

const { t } = useI18n()
const { formatFileSize } = useAsset()

interface Segment {
  key: keyof StorageBreakdown
  label: string
  size: number
  dot: string
  bar: string
}

interface Metric {
  type: AssetFilterType
  label: string
  value: number
  icon: string
  tone: string
}

const segments = computed<Segment[]>(() => [
  { key: 'images', label: t('sections.stats.images'), size: props.storageBreakdown.images, dot: 'bg-primary', bar: 'bg-primary' },
  { key: 'videos', label: t('sections.stats.videos'), size: props.storageBreakdown.videos, dot: 'bg-info', bar: 'bg-info' },
  { key: 'documents', label: t('sections.stats.documents'), size: props.storageBreakdown.documents, dot: 'bg-success', bar: 'bg-success' },
  { key: 'other', label: t('sections.stats.other'), size: props.storageBreakdown.other, dot: 'bg-warning', bar: 'bg-warning' },
])

const metrics = computed<Metric[]>(() => [
  { type: 'all', label: t('sections.stats.total_files'), value: props.assetStats.total, icon: 'lucide:files', tone: 'bg-primary/10 text-primary' },
  { type: 'image', label: t('sections.stats.images'), value: props.assetStats.images, icon: 'lucide:image', tone: 'bg-info/10 text-info' },
  { type: 'video', label: t('sections.stats.videos'), value: props.assetStats.videos, icon: 'lucide:video', tone: 'bg-success/10 text-success' },
  { type: 'document', label: t('sections.stats.documents'), value: props.assetStats.documents, icon: 'lucide:file', tone: 'bg-warning/10 text-warning' },
])

const totalSize = computed(() => props.storageUsage.totalSize || 1)

function percent(size: number): number {
  return Math.max(0, Math.round((size / totalSize.value) * 100))
}

function isActive(type: AssetFilterType): boolean {
  return (props.activeType ?? 'all') === type
}

function handleSelectType(type: AssetFilterType) {
  emit('selectType', type)
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <UCard v-motion-fade :duration="200" :ui="{ body: 'sm:p-5' }" class="min-h-[250px] min-w-0">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-highlighted">{{ t('sections.stats.storage') }}</p>
          <p class="text-xs text-muted">{{ t('sections.stats.file_count', { count: props.storageUsage.count }) }}</p>
          <p class="mt-2 whitespace-nowrap text-3xl font-bold tracking-tight text-highlighted">{{ props.storageUsage.formattedSize }}</p>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-folder-plus"
            :label="t('buttons.new_folder')" @click="emit('createFolder')" />
          <UButton size="sm" color="primary" icon="i-lucide-upload" :label="t('buttons.upload_assets')"
            @click="emit('upload')" />
        </div>
      </div>

      <div class="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-elevated">
        <div class="flex h-full w-full">
          <span v-for="segment in segments" v-show="segment.size > 0" :key="segment.key" :class="segment.bar"
            :style="{ width: `${percent(segment.size)}%` }"
            :title="`${segment.label}: ${formatFileSize(segment.size)}`" />
        </div>
      </div>

      <dl class="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
        <div v-for="segment in segments" :key="segment.key" class="flex items-center justify-between gap-2 text-xs">
          <dt class="flex min-w-0 items-center gap-1.5 text-muted">
            <span class="size-1.5 shrink-0 rounded-full" :class="segment.dot" />
            <span class="truncate">{{ segment.label }}</span>
          </dt>
          <dd class="shrink-0 tabular-nums text-highlighted">{{ formatFileSize(segment.size) }}</dd>
        </div>
      </dl>
    </UCard>

    <div class="grid min-w-0 grid-cols-2 gap-3">
      <button v-for="metric in metrics" :key="metric.type" type="button"
        class="group flex items-center gap-3 rounded-2xl border border-default bg-elevated/40 p-3 text-left transition-colors hover:border-primary/40 hover:bg-elevated"
        :class="isActive(metric.type) ? 'ring-1 ring-primary/50' : ''" :aria-pressed="isActive(metric.type)"
        @click="() => handleSelectType(metric.type)">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg" :class="metric.tone">
          <Icon :name="metric.icon" class="size-4" />
        </span>
        <span class="min-w-0">
          <span class="block text-xl font-bold leading-tight tabular-nums text-highlighted">{{ metric.value }}</span>
          <span class="block truncate text-[11px] text-muted">{{ metric.label }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
