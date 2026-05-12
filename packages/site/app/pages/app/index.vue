<i18n src="./DashboardOverviewCards.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: Dashboard page showing real platform stats
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { SocialMediaPlatform } from '#layers/BaseUI/app/composables/usePlatformIcons'
import { usePlatformIcons } from '#layers/BaseUI/app/composables/usePlatformIcons'
import type { EChartsOption } from 'echarts'
import type { DashboardData, CollectStatsResult } from '~~/app/composables/usePlatformStats'

const { t } = useI18n()
const { getPlatformIcon } = usePlatformIcons()
const { dashboard, fetchDashboard, collectStats, collecting } = usePlatformStats()
const { user } = UseUser()
const toast = useToast()
const colorMode = useColorMode()

async function handleCollectStats() {
  if (user.value?.id) {
    const result = await collectStats({})
    if (result) {
      toast.add({
        title: 'Stats Collected',
        description: `Successfully collected stats for ${result.successful} of ${result.total} platforms`,
        color: 'success'
      })

      const failedResults = result.results?.filter((r: CollectStatsResult) => !r.success) || []
      for (const failed of failedResults) {
        toast.add({
          title: `${failed.platform} Stats Failed`,
          description: failed.error || 'Unknown error',
          color: 'error',
          icon: 'i-heroicons-exclamation-triangle'
        })
      }

      await fetchDashboard({})
    }
  }
}

const displayMetrics = computed(() => {
  if (!dashboard.value) return []
  const { summary } = dashboard.value
  return [
    {
      id: 'posts',
      title: 'totalPosts',
      value: formatNumber(summary.postsLast30Days),
      change: '+0%',
      trend: 'up' as const,
      icon: 'lucide:calendar-days',
      color: 'bg-primary/10 text-primary',
    },
    {
      id: 'followers',
      title: 'totalFollowers',
      value: formatNumber(summary.totalFollowers),
      change: '+0%',
      trend: 'up' as const,
      icon: 'lucide:users',
      color: 'bg-secondary text-secondary-foreground',
    },
    {
      id: 'engagement',
      title: 'totalEngagement',
      value: formatNumber(summary.totalEngagement),
      change: '+0%',
      trend: 'up' as const,
      icon: 'lucide:heart',
      color: 'bg-rose-500/10 text-rose-500',
    },
  ].map(metric => ({ ...metric, title: t(metric.title) }))
})

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function getChartOptions(platformGraph: PlatformGraph): EChartsOption {
  const isDark = colorMode.value === 'dark'
  const textColor = isDark ? '#A1A09E' : '#79747E'
  const lineColor = isDark ? '#1C1917' : '#E5E4E0'
  const primaryColor = isDark ? '#D94F12' : '#F97316'

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1C1917' : '#FFFFFF',
      borderColor: lineColor,
      textStyle: {
        color: isDark ? '#FAF9F7' : '#0F0E0D',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: platformGraph.labels,
      axisLine: { lineStyle: { color: lineColor } },
      axisLabel: { color: textColor, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: lineColor } },
      axisLabel: { color: textColor, fontSize: 10 },
      splitLine: { lineStyle: { color: lineColor, opacity: 0.3 } },
    },
    series: [
      {
        name: t('followers'),
        type: 'line',
        smooth: true,
        data: platformGraph.followers,
        lineStyle: { color: primaryColor, width: 2 },
        areaStyle: {
          opacity: 0.3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: primaryColor },
              { offset: 1, color: 'transparent' },
            ],
          },
        },
        itemStyle: { color: primaryColor },
      },
      {
        name: t('posts'),
        type: 'line',
        smooth: true,
        data: platformGraph.posts,
        lineStyle: { color: '#3B82F6', width: 2 },
        areaStyle: {
          opacity: 0.2,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#3B82F6' },
              { offset: 1, color: 'transparent' },
            ],
          },
        },
        itemStyle: { color: '#3B82F6' },
      },
      {
        name: t('engagement'),
        type: 'line',
        smooth: true,
        data: platformGraph.engagement,
        lineStyle: { color: '#10B981', width: 2 },
        areaStyle: {
          opacity: 0.2,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#10B981' },
              { offset: 1, color: 'transparent' },
            ],
          },
        },
        itemStyle: { color: '#10B981' },
      },
    ],
    legend: {
      show: platformGraph.labels.length > 0,
      top: 0,
      textStyle: { color: textColor, fontSize: 10 },
    },
  }
}

onMounted(async () => {
  if (user.value?.id) {
    await fetchDashboard({})
  }
})
</script>

<template>
  <BaseDashboardOverviewCards :display-metrics="displayMetrics">
    <template v-if="dashboard">
      <div class="col-span-1 lg:col-span-3">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold tracking-tight text-white">
            {{ t('platformPerformance') }}
          </h2>
          <UButton size="sm" variant="ghost" color="neutral" :loading="collecting" @click="handleCollectStats">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-2" />
            {{ t('refreshStats') }}
          </UButton>
        </div>
      </div>

      <template v-if="dashboard.platformGraphs.length > 0">
        <div v-for="platformGraph in dashboard.platformGraphs" :key="platformGraph.platform + platformGraph.accountId"
          class="col-span-1">
          <UCard class="h-full" :ui="{ title: 'p-0 sm:px-2', }">
            <template #header>
              <div class=" flex items-center gap-3">
                <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
                  <Icon :name="getPlatformIcon(platformGraph.platform as SocialMediaPlatform)"
                    class="w-4 h-4 text-secondary-foreground" />
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-foreground capitalize truncate">
                    {{ platformGraph.platform }}
                  </h3>
                  <p v-if="platformGraph.accountName" class="text-xs text-muted-foreground truncate">
                    {{ platformGraph.accountName }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-medium text-foreground">
                    {{ formatNumber(platformGraph.current.followers) }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ t('followers') }}
                  </p>
                </div>
              </div>
            </template>

            <BaseChart v-if="platformGraph.labels.length > 0" :title="t('last30Days')"
              :description="`${platformGraph.platform} performance over time`"
              :icon="getPlatformIcon(platformGraph.platform as SocialMediaPlatform)"
              :chart-options="getChartOptions(platformGraph)" />

            <div class="grid grid-cols-3 gap-4">
              <div class="text-center p-3 rounded-lg bg-muted/50">
                <p class="text-xl font-bold text-foreground">
                  {{ formatNumber(platformGraph.current.followers) }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ t('followers') }}
                </p>
              </div>
              <div class="text-center p-3 rounded-lg bg-muted/50">
                <p class="text-xl font-bold text-foreground">
                  {{ formatNumber(platformGraph.current.posts) }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ t('posts') }}
                </p>
              </div>
              <div class="text-center p-3 rounded-lg bg-muted/50">
                <p class="text-xl font-bold text-foreground">
                  {{ formatNumber(platformGraph.current.engagement) }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ t('engagement') }}
                </p>
              </div>
            </div>


          </UCard>
        </div>
      </template>

      <div v-else class="col-span-1 lg:col-span-3">
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <div class="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <Icon name="i-heroicons-chart-bar" class="w-8 h-8 text-muted-foreground" />
          </div>
          <p class="text-gray-400 mb-4">{{ t('noStatsCollected') }}</p>
          <UButton color="primary" :loading="collecting" @click="handleCollectStats">
            {{ t('collectStats') }}
          </UButton>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="col-span-1 lg:col-span-3 flex justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    </template>
  </BaseDashboardOverviewCards>
</template>

<style scoped></style>