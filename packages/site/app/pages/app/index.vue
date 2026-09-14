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
import type { CollectStatsResult, PlatformStats, PlatformGraph } from '~~/app/composables/usePlatformStats'
import { useTimeAgo } from '@vueuse/core'

const { t } = useI18n()
const { getPlatformIcon } = usePlatformIcons()
const { dashboard, fetchDashboard, collectStats, collecting, topPosts, fetchTopPosts, bestTimes, fetchBestTimes, setRange, range, exportCsv, exporting } = usePlatformStats()
const { user } = UseUser()
const toast = useToast()
const colorMode = useColorMode()
const activeBusinessId = useState<string | null>('business:id', () => null)
const { steps: setupSteps, fetch: fetchSetupState } = useGettingStarted()

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

async function handleRangeChange(newRange: 7 | 30 | 90) {
  setRange(newRange)
  await fetchDashboard({})
  await fetchTopPosts({ days: newRange })
  await fetchBestTimes({ days: newRange })
}

const bestTimeDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatBestTimeSlot(slot: { dayOfWeek: number; hour: number }) {
  const day = bestTimeDayNames[slot.dayOfWeek] ?? ''
  const hour12 = slot.hour % 12 === 0 ? 12 : slot.hour % 12
  const suffix = slot.hour < 12 ? 'AM' : 'PM'
  return `${day} ${hour12}${suffix} UTC`
}

async function handleExport() {
  await exportCsv({ days: range.value })
  toast.add({
    title: 'Export Complete',
    description: 'CSV file downloaded',
    color: 'success'
  })
}

function handleRepurposePost(content: string) {
  navigateTo({
    path: '/app/tools/content-split',
    query: { content },
  })
}
function getFreshnessColor(status: string): 'success' | 'info' | 'error' | 'warning' | 'neutral' {
  switch (status) {
    case 'idle': return 'success'
    case 'running': return 'info'
    case 'error': return 'error'
    case 'rate_limited': return 'warning'
    default: return 'neutral'
  }
}

function getFreshnessLabel(entry: { status: string; lastCollectedAt?: string }) {
  if (entry.status === 'error') return 'Sync error'
  if (!entry.lastCollectedAt) return 'Never collected'
  return useTimeAgo(new Date(entry.lastCollectedAt)).value
}

const timeAgo = computed(() => {
  return (date: string | undefined) => {
    if (!date) return '—'
    return useTimeAgo(new Date(date)).value
  }
})

function avgGrowth(stats: PlatformStats[], field: 'followers' | 'posts' | 'engagement'): { absolute: number; percentage: number } {
  let absolute = 0; let percentage = 0; let count = 0
  for (const s of stats) {
    const g = s.growth?.[field]
    if (g) { absolute += g.absolute; percentage += g.percentage; count++ }
  }
  return { absolute, percentage: count > 0 ? percentage / count : 0 }
}

const displayMetrics = computed(() => {
  if (!dashboard.value) return []
  const { summary, currentStats } = dashboard.value
  const followerGrowth = avgGrowth(currentStats, 'followers')
  const engagementGrowth = avgGrowth(currentStats, 'engagement')
  const postGrowth = avgGrowth(currentStats, 'posts')
  return [
    {
      id: 'posts',
      title: 'totalPosts',
      value: formatNumber(summary.postsLast30Days),
      change: `${postGrowth.percentage >= 0 ? '+' : ''}${postGrowth.percentage.toFixed(1)}%`,
      trend: postGrowth.percentage >= 0 ? 'up' : 'down',
      icon: 'lucide:calendar-days',
      color: 'bg-primary/10 text-primary',
    },
    {
      id: 'followers',
      title: 'totalFollowers',
      value: formatNumber(summary.totalFollowers),
      change: `${followerGrowth.percentage >= 0 ? '+' : ''}${followerGrowth.percentage.toFixed(1)}%`,
      trend: followerGrowth.percentage >= 0 ? 'up' : 'down',
      icon: 'lucide:users',
      color: 'bg-secondary text-secondary-foreground',
    },
    {
      id: 'engagement',
      title: 'totalEngagement',
      value: formatNumber(summary.totalEngagement),
      change: `${engagementGrowth.percentage >= 0 ? '+' : ''}${engagementGrowth.percentage.toFixed(1)}%`,
      trend: engagementGrowth.percentage >= 0 ? 'up' : 'down',
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

function getPlatformStat(graph: PlatformGraph, key: 'likes' | 'comments' | 'impressions' | 'saves' | 'shares' | 'views'): number {
  if (!dashboard.value) return 0
  const stat = dashboard.value.currentStats.find(
    s => s.platform === graph.platform && s.accountId === (graph.accountId || '')
  )
  return (stat?.engagement as Record<string, number>)?.[key] ?? 0
}

function getPlatformGrowth(graph: PlatformGraph): { absolute: number; percentage: number } | null {
  if (!dashboard.value) return null
  const stat = dashboard.value.currentStats.find(
    s => s.platform === graph.platform && s.accountId === (graph.accountId || '')
  )
  const growth = stat?.growth?.followers
  if (!growth) return null
  return growth
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
    await Promise.all([fetchDashboard({}), fetchSetupState()])
    await fetchTopPosts({ days: 30 })
    await fetchBestTimes({ days: 30 })
  }
})
</script>

<template>
  <div class=" p-4 lg:mx-auto lg:p-6">
    <BaseGettingStarted v-if="user?.id" :steps="setupSteps" />

    <div class="flex flex-wrap items-center gap-2">
      <UButton to="/app/posts/new" icon="i-lucide-plus" size="lg">
        {{ t('quickCreatePost') }}
      </UButton>
      <UButton to="/app/integrations" icon="i-lucide-plug" variant="outline" color="neutral" size="lg">
        {{ t('quickConnect') }}
      </UButton>
      <UButton to="/app/calendar" icon="i-lucide-calendar" variant="ghost" color="neutral" size="lg">
        {{ t('quickCalendar') }}
      </UButton>
      <UButton to="/app/inbox" icon="i-lucide-inbox" variant="outline" color="neutral" size="lg">
        {{ t('quickInbox') }}
      </UButton>
      <UButton to="/app/auto-reply" icon="i-lucide-message-circle-heart" variant="outline" color="neutral" size="lg">
        {{ t('quickAutoReply') }}
      </UButton>
      <UButton v-if="activeBusinessId" :to="`/app/business/${activeBusinessId}/content`" icon="i-lucide-kanban"
        variant="outline" color="neutral" size="lg">
        {{ t('quickContentBoard') }}
      </UButton>
    </div>

    <BaseDashboardOverviewCards :display-metrics="displayMetrics">
      <template v-if="dashboard">
        <AnnouncementBanner class="col-span-1 lg:col-span-3" />
        <div class="col-span-1 lg:col-span-3">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 class="text-lg font-semibold tracking-tight text-white">
              {{ t('platformPerformance') }}
            </h2>
            <div class="flex items-center gap-2">
              <USelectMenu :model-value="range" :options="[
                { label: t('range7'), value: 7 },
                { label: t('range30'), value: 30 },
                { label: t('range90'), value: 90 },
              ]" size="sm" @update:model-value="(v: 7 | 30 | 90) => handleRangeChange(v)" />
              <UButton size="sm" variant="outline" color="neutral" :loading="exporting" @click="handleExport">
                <UIcon name="i-lucide-download" class="w-4 h-4 mr-1" />
                {{ t('exportCsv') }}
              </UButton>
              <UButton size="sm" variant="ghost" color="neutral" :loading="collecting" @click="handleCollectStats">
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-1" />
                {{ t('refreshStats') }}
              </UButton>
            </div>
          </div>

          <!-- Freshness chips -->
          <div v-if="dashboard.freshness?.length" class="flex flex-wrap gap-2 mb-4">
            <UBadge v-for="entry in dashboard.freshness" :key="entry.accountId" :color="getFreshnessColor(entry.status)"
              variant="subtle" size="xs" :title="`${entry.accountName} · ${entry.status}`">
              <Icon :name="getPlatformIcon(entry.platform as SocialMediaPlatform)" class="w-3 h-3 mr-1" />
              {{ getFreshnessLabel(entry) }}
            </UBadge>
          </div>
        </div>

        <template v-if="dashboard.platformGraphs.length > 0">
          <div v-for="platformGraph in dashboard.platformGraphs" :key="platformGraph.platform + platformGraph.accountId"
            class="col-span-1">
            <UCard class="h-full" :ui="{ title: 'p-0 sm:px-2', }">
              <template #header>
                <div class=" flex items-center gap-3">
                  <!-- <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
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
                </div> -->
                </div>
              </template>

              <BaseChart v-if="platformGraph.labels.length > 0" :title="t('last30Days')"
                :description="`${platformGraph.accountName} performance over time`"
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
                    {{ formatNumber(platformGraph.current.following) }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ t('following') }}
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

              <div class="grid grid-cols-3 gap-2 mt-3">
                <div v-if="getPlatformStat(platformGraph, 'likes') > 0" class="text-center p-2 rounded-lg bg-muted/30">
                  <p class="text-xs font-semibold text-foreground">{{ formatNumber(getPlatformStat(platformGraph,
                    'likes')) }}</p>
                  <p class="text-[10px] text-muted-foreground">{{ t('likes') }}</p>
                </div>
                <div v-if="getPlatformStat(platformGraph, 'comments') > 0"
                  class="text-center p-2 rounded-lg bg-muted/30">
                  <p class="text-xs font-semibold text-foreground">{{ formatNumber(getPlatformStat(platformGraph,
                    'comments')) }}</p>
                  <p class="text-[10px] text-muted-foreground">{{ t('comments') }}</p>
                </div>
                <div v-if="getPlatformStat(platformGraph, 'impressions') > 0"
                  class="text-center p-2 rounded-lg bg-muted/30">
                  <p class="text-xs font-semibold text-foreground">{{ formatNumber(getPlatformStat(platformGraph,
                    'impressions')) }}
                  </p>
                  <p class="text-[10px] text-muted-foreground">{{ t('impressions') }}</p>
                </div>
                <div v-if="getPlatformStat(platformGraph, 'saves') > 0" class="text-center p-2 rounded-lg bg-muted/30">
                  <p class="text-xs font-semibold text-foreground">{{ formatNumber(getPlatformStat(platformGraph,
                    'saves')) }}</p>
                  <p class="text-[10px] text-muted-foreground">{{ t('saves') }}</p>
                </div>
                <div v-if="getPlatformStat(platformGraph, 'shares') > 0" class="text-center p-2 rounded-lg bg-muted/30">
                  <p class="text-xs font-semibold text-foreground">{{ formatNumber(getPlatformStat(platformGraph,
                    'shares')) }}</p>
                  <p class="text-[10px] text-muted-foreground">{{ t('shares') }}</p>
                </div>
                <div v-if="getPlatformStat(platformGraph, 'views') > 0" class="text-center p-2 rounded-lg bg-muted/30">
                  <p class="text-xs font-semibold text-foreground">{{ formatNumber(getPlatformStat(platformGraph,
                    'views')) }}</p>
                  <p class="text-[10px] text-muted-foreground">{{ t('views') }}</p>
                </div>
              </div>

              <div v-if="getPlatformGrowth(platformGraph)" class="flex items-center justify-end gap-2 mt-2">
                <UBadge :color="(getPlatformGrowth(platformGraph)?.percentage ?? 0) >= 0 ? 'success' : 'error'"
                  variant="subtle" size="sm">
                  <Icon
                    :name="(getPlatformGrowth(platformGraph)?.percentage ?? 0) >= 0 ? 'lucide:trending-up' : 'lucide:trending-down'"
                    class="w-3 h-3 mr-1" />
                  {{ (getPlatformGrowth(platformGraph)?.percentage ?? 0) >= 0 ? '+' : '' }}{{
                    (getPlatformGrowth(platformGraph)?.percentage ?? 0).toFixed(1) }}%
                </UBadge>
                <span class="text-[10px] text-muted-foreground">{{ t('followerGrowth') }}</span>
              </div>


            </UCard>
          </div>
        </template>

        <template v-if="topPosts.length > 0">
          <div class="col-span-1 lg:col-span-3">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="font-semibold text-foreground">{{ t('topPosts') }}</h3>
                    <p class="text-xs text-muted-foreground mt-0.5">{{ t('topPostsDescription') }}</p>
                  </div>
                </div>
              </template>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-border">
                      <th class="text-left py-2 px-3 font-medium text-muted-foreground">{{ t('platform') }}</th>
                      <th class="text-left py-2 px-3 font-medium text-muted-foreground">{{ t('post') }}</th>
                      <th class="text-right py-2 px-3 font-medium text-muted-foreground">{{ t('likes') }}</th>
                      <th class="text-right py-2 px-3 font-medium text-muted-foreground">{{ t('comments') }}</th>
                      <th class="text-right py-2 px-3 font-medium text-muted-foreground">{{ t('shares') }}</th>
                      <th class="text-right py-2 px-3 font-medium text-muted-foreground">{{ t('views') }}</th>
                      <th class="text-right py-2 px-3 font-medium text-muted-foreground">{{ t('engagement') }}</th>
                      <th class="text-right py-2 px-3 font-medium text-muted-foreground">{{ t('actions') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="post in topPosts" :key="post.postId" class="border-b border-border/50 hover:bg-muted/30">
                      <td class="py-2 px-3">
                        <Icon :name="getPlatformIcon(post.platform)" class="w-4 h-4" />
                      </td>
                      <td class="py-2 px-3 max-w-[200px] truncate">
                        <span class="text-foreground">{{ post.content || post.postId }}</span>
                      </td>
                      <td class="py-2 px-3 text-right text-foreground">{{ formatNumber(post.metrics?.likes ?? 0) }}</td>
                      <td class="py-2 px-3 text-right text-foreground">{{ formatNumber(post.metrics?.comments ?? 0) }}
                      </td>
                      <td class="py-2 px-3 text-right text-foreground">{{ formatNumber(post.metrics?.shares ?? 0) }}
                      </td>
                      <td class="py-2 px-3 text-right text-foreground">{{ formatNumber(post.metrics?.views ?? 0) }}</td>
                      <td class="py-2 px-3 text-right text-foreground">{{ formatNumber(post.metrics?.total ?? 0) }}</td>
                      <td class="py-2 px-3 text-right">
                        <UButton size="xs" variant="ghost" color="primary"
                          @click="handleRepurposePost(post.content || '')">
                          {{ t('repurpose') }}
                        </UButton>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </UCard>
          </div>
        </template>

        <template v-if="bestTimes && bestTimes.topSlots.length > 0">
          <div class="col-span-1 lg:col-span-3">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="font-semibold text-foreground">{{ t('bestTimes') }}</h3>
                    <p class="text-xs text-muted-foreground mt-0.5">{{ t('bestTimesDescription') }}</p>
                  </div>
                </div>
              </template>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-border">
                      <th class="text-left py-2 px-3 font-medium text-muted-foreground">{{ t('platform') }}</th>
                      <th class="text-left py-2 px-3 font-medium text-muted-foreground">{{ t('bestTimeSlot') }}</th>
                      <th class="text-right py-2 px-3 font-medium text-muted-foreground">{{ t('engagement') }}</th>
                      <th class="text-right py-2 px-3 font-medium text-muted-foreground">{{ t('posts') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(slot, idx) in bestTimes.topSlots"
                      :key="`${slot.platform}-${slot.dayOfWeek}-${slot.hour}`"
                      class="border-b border-border/50 hover:bg-muted/30">
                      <td class="py-2 px-3">
                        <span class="inline-flex items-center gap-2">
                          <Icon :name="getPlatformIcon(slot.platform)" class="w-4 h-4" />
                          <span v-if="idx === 0"
                            class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{{
                              t('bestPick')
                            }}</span>
                        </span>
                      </td>
                      <td class="py-2 px-3 text-foreground">{{ formatBestTimeSlot(slot) }}</td>
                      <td class="py-2 px-3 text-right text-foreground">{{ formatNumber(slot.avgEngagement) }}</td>
                      <td class="py-2 px-3 text-right text-foreground">{{ slot.postCount }}</td>
                    </tr>
                  </tbody>
                </table>
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
  </div>
</template>

<style scoped></style>