/**
 * Composable for dashboard metrics operations
 * Uses real platform stats from the database
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import type { PlatformStats } from './usePlatformStats'

type DashboardMetric = {
  id: string
  title: string
  value: string
  change: string
  trend: 'up' | 'down'
  icon: string
  color: string
}

type ChartDataItem = {
  name: string
  value: number
}

export const useDashboardMetrics = () => {
  const { fetchStats, fetchTimeSeries, totalFollowers, totalPosts, totalEngagement, stats, timeSeries, loading, error } = usePlatformStats()

  // Reactive state — initialized with real data
  const metrics = ref<DashboardMetric[]>([])
  const chartData = ref({
    posts: {
      weekly: [] as number[],
      labels: [] as string[],
    },
    reviews: {
      weekly: [] as number[],
      labels: [] as string[],
    },
    content: {
      distribution: [] as ChartDataItem[],
    },
  })

  // Load real data from the API
  const fetchMetrics = async (filters: { businessId?: string; userId?: string } = {}) => {
    try {
      // Fetch current stats + time series in parallel
      await Promise.all([
        fetchStats(filters),
        fetchTimeSeries({ ...filters, days: 7, metric: 'followers' }),
      ])

      const allStats = stats.value
      const ts = timeSeries.value

      // Build metrics from real data
      metrics.value = [
        {
          id: 'followers',
          title: 'totalFollowers',
          value: formatNumber(totalFollowers.value),
          change: calculateChange(allStats, 'followers'),
          trend: getTrend(allStats, 'followers'),
          icon: 'lucide:users',
          color: 'text-blue-600',
        },
        {
          id: 'posts',
          title: 'totalPosts',
          value: formatNumber(totalPosts.value),
          change: calculateChange(allStats, 'posts'),
          trend: getTrend(allStats, 'posts'),
          icon: 'lucide:calendar-days',
          color: 'text-green-600',
        },
        {
          id: 'engagement',
          title: 'totalEngagement',
          value: formatNumber(totalEngagement.value),
          change: calculateChange(allStats, 'engagement'),
          trend: getTrend(allStats, 'engagement'),
          icon: 'lucide:heart',
          color: 'text-red-600',
        },
      ]

      // Build posts time series for the chart
      chartData.value.posts.weekly = ts.datasets[0]?.data || []
      chartData.value.posts.labels = ts.labels || []

      // Build engagement time series (use reviews slot for engagement)
      chartData.value.reviews.weekly = ts.datasets[0]?.data || []
      chartData.value.reviews.labels = ts.labels || []

      // Build platform distribution from aggregated data
      chartData.value.content.distribution = buildDistribution(allStats)

    } catch (err: any) {
      // Consider using a proper logging library in production
      // Error is handled by the parent usePlatformStats composable
    }
  }

  const refreshMetrics = async (filters?: { businessId?: string; userId?: string }) => {
    await fetchMetrics(filters)
  }

  // ---- Helpers ----

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
  }

  function getTrend(allStats: PlatformStats[], metric: 'followers' | 'posts' | 'engagement'): 'up' | 'down' {
    const hasGrowth = allStats.some(s => {
      const g = s.growth
      if (!g) return false
      const m = g[metric]
      return m && m.absolute > 0
    })
    return hasGrowth ? 'up' : 'down'
  }

  function calculateChange(allStats: PlatformStats[], metric: 'followers' | 'posts' | 'engagement'): string {
    let totalChange = 0
    let totalBase = 0

    for (const s of allStats) {
      const g = s.growth
      if (g) {
        const m = g[metric]
        if (m) {
          totalChange += m.absolute
          if (metric === 'followers') totalBase += (s.followers ?? 0) - m.absolute
          else if (metric === 'posts') totalBase += (s.posts ?? 0) - m.absolute
          else totalBase += (s.engagement?.total ?? 0) - m.absolute
        }
      }
    }

    if (totalBase === 0) return '0%'
    const pct = Math.round((totalChange / totalBase) * 100)
    return `${pct > 0 ? '+' : ''}${pct}%`
  }

  function buildDistribution(allStats: PlatformStats[]): ChartDataItem[] {
    const map = new Map<string, number>()
    for (const s of allStats) {
      const key = s.platform.charAt(0).toUpperCase() + s.platform.slice(1)
      map.set(key, (map.get(key) || 0) + (s.followers ?? 0))
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }

  // Chart configuration helpers
  const getBarChartConfig = (data: readonly number[], labels: readonly string[], name: string) => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'hsl(0 0% 100%)',
      borderColor: 'hsl(20 5.9% 90%)',
      borderWidth: 1,
      textStyle: {
        color: 'hsl(20 14.3% 4.1%)'
      }
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '10%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: {
        lineStyle: { color: 'hsl(20 5.9% 90%)' }
      },
      axisTick: { show: false },
      axisLabel: {
        color: 'hsl(24.6 95% 48.1%)',
        fontSize: 12
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'hsl(25 5.3% 44.7%)',
        fontSize: 12
      },
      splitLine: {
        lineStyle: {
          color: 'hsl(20 5.9% 90%)',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        name,
        type: 'bar',
        data,
        itemStyle: {
          color: 'hsl(24.6 95% 48.1%)',
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: {
            color: 'hsl(24.6 95% 48.1% / 0.8)'
          }
        }
      }
    ]
  })

  const getLineChartConfig = (data: readonly number[], labels: readonly string[], name: string) => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'hsl(0 0% 100%)',
      borderColor: 'hsl(20 5.9% 90%)',
      borderWidth: 1,
      textStyle: {
        color: 'hsl(20 14.3% 4.1%)'
      }
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '10%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisLine: {
        lineStyle: { color: 'hsl(20 5.9% 90%)' }
      },
      axisTick: { show: false },
      axisLabel: {
        color: 'hsl(25 5.3% 44.7%)',
        fontSize: 12
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'hsl(25 5.3% 44.7%)',
        fontSize: 12
      },
      splitLine: {
        lineStyle: {
          color: 'hsl(20 5.9% 90%)',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        name,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 3, color: '#10B981' },
        itemStyle: {
          color: '#10B981',
          borderWidth: 2,
          borderColor: 'hsl(0 0% 100%)'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.25)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.06)' }
            ]
          }
        },
        data
      }
    ]
  })

  const getPieChartConfig = (data: ReadonlyArray<{ name: string; value: number }>, t: (key: string) => string) => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'hsl(0 0% 100%)',
      borderColor: 'hsl(20 5.9% 90%)',
      borderWidth: 1,
      textStyle: {
        color: 'hsl(20 14.3% 4.1%)'
      }
    },
    series: [
      {
        name: t('content'),
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['50%', '55%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: 'hsl(20 14.3% 4.1%)'
          }
        },
        labelLine: { show: false },
        data: data.map((item, index) => ({
          value: item.value,
          name: t(item.name),
          itemStyle: {
            color: ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'][index] || '#8B5CF6'
          }
        }))
      }
    ]
  })

  // Computed
  const hasData = computed(() => metrics.value.length > 0)
  const totalPostsCount = computed(() => parseInt(metrics.value.find(m => m.id === 'posts')?.value || '0'))
  const totalReviewsCount = computed(() => parseInt(metrics.value.find(m => m.id === 'engagement')?.value || '0'))
  const totalContentCount = computed(() => parseInt(metrics.value.find(m => m.id === 'followers')?.value || '0'))

  return {
    // State
    metrics: readonly(metrics),
    chartData: readonly(chartData),
    loading: readonly(loading),
    error: readonly(error),

    // Computed
    hasData,
    totalPosts: totalPostsCount,
    totalReviews: totalReviewsCount,
    totalContent: totalContentCount,

    // Methods
    fetchMetrics,
    refreshMetrics,
    getBarChartConfig,
    getLineChartConfig,
    getPieChartConfig
  }
}
