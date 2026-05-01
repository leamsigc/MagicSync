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
import { type EChartsOption } from 'echarts'

const { t } = useI18n()
const { metrics, chartData, getLineChartConfig, getBarChartConfig, getPieChartConfig, fetchMetrics, loading } = useDashboardMetrics()

// Load real data on mount
onMounted(async () => {
  // Get current business from session/user
  const { user } = UseUser()
  if (user.value?.id) {
    await fetchMetrics({ userId: user.value.id })
  }
})

const displayMetrics = computed(() =>
  metrics.value.map(metric => ({
    ...metric,
    title: t(metric.title)
  }))
)

const postOptions = computed((): EChartsOption => {
  if (!chartData.value.posts.weekly.length) return {} as EChartsOption
  const config = getBarChartConfig(
    chartData.value.posts.weekly,
    chartData.value.posts.labels,
    t('followers')
  )
  return config as EChartsOption
})

const reviewOptions = computed((): EChartsOption => {
  if (!chartData.value.reviews.weekly.length) return {} as EChartsOption
  const config = getLineChartConfig(
    chartData.value.reviews.weekly,
    chartData.value.reviews.labels,
    t('engagement')
  )
  return config as EChartsOption
})

const contentOptions = computed((): EChartsOption => {
  if (!chartData.value.content.distribution.length) return {} as EChartsOption
  const config = getPieChartConfig(
    chartData.value.content.distribution,
    t
  )
  return config as EChartsOption
})
</script>

<template>
  <BaseDashboardOverviewCards :display-metrics="displayMetrics">
    <BaseChart :title="t('postsScheduled')" :description="t('weeklyOverview')" icon="lucide:bar-chart-3"
      :chart-options="postOptions" />
    <BaseChart :title="t('newReviews')" :description="t('lastSevenDays')" icon="lucide:trending-up"
      :chart-options="reviewOptions" />
    <BaseChart :title="t('aiContent')" :description="t('generatedContent')" icon="lucide:sparkles"
      :chart-options="contentOptions" />
  </BaseDashboardOverviewCards>

</template>
<style scoped></style>