<!--  Translation file -->
<i18n src="../index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Asset Statistics Cards
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test
 * @todo [✔] Update the typescript
 */

type AssetStats = {
  total: number
  images: number
  videos: number
  documents: number
}

type StorageUsage = {
  formattedSize: string
}

type Props = {
  assetStats: AssetStats
  storageUsage: StorageUsage
}

type Metric = {
  title: string
  value: number | string
  icon: string
  color: string
}

const props = defineProps<Props>()
const { t } = useI18n()

const displayMetrics = computed<Metric[]>(() => [
  {
    title: t('sections.stats.total_files'),
    value: props.assetStats.total,
    icon: 'lucide:files',
    color: 'bg-blue-500/10 text-blue-500',
  },
  {
    title: t('sections.stats.images'),
    value: props.assetStats.images,
    icon: 'lucide:image',
    color: 'bg-green-500/10 text-green-500',
  },
  {
    title: t('sections.stats.videos'),
    value: props.assetStats.videos,
    icon: 'lucide:video',
    color: 'bg-purple-500/10 text-purple-500',
  },
  {
    title: t('sections.stats.documents'),
    value: props.assetStats.documents,
    icon: 'lucide:file',
    color: 'bg-orange-500/10 text-orange-500',
  },
  {
    title: t('sections.stats.storage'),
    value: props.storageUsage.formattedSize,
    icon: 'lucide:hard-drive',
    color: 'bg-red-500/10 text-red-500',
  },
])
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-5 gap-4" v-motion-fade-visible>
    <UCard variant="soft" v-for="metric in displayMetrics" :key="metric.title" class="p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-lg" :class="metric.color">
          <Icon :name="metric.icon" class="w-5 h-5" />
        </div>
      </div>

      <div class="space-y-1">
        <div class="text-2xl font-bold">{{ metric.value }}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">{{ metric.title }}</div>
      </div>
    </UCard>
  </div>
</template>
