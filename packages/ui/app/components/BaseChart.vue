<script lang="ts" setup>
import * as echarts from 'echarts'
import { type EChartsOption } from 'echarts'

const props = defineProps<{
  title: string
  description: string
  icon: string
  chartOptions: EChartsOption
}>()


const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const initializeChart = () => {
  if (chartRef.value && !chartInstance) {
    chartInstance = echarts.init(chartRef.value)
    chartInstance.setOption(props.chartOptions)
  }
}

const updateChart = () => {
  if (chartInstance) {
    chartInstance.setOption(props.chartOptions)
  }
}

onMounted(() => {
  nextTick(() => {
    initializeChart()
  })
})

watch(props, () => {
  updateChart()
}, { deep: true })

// Watcher to initialize chart when chartRef becomes available
watch(chartRef, () => {
  if (chartRef.value && !chartInstance) {
    initializeChart()
  }
})



onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<template>
  <UCard :ui="{ root: 'border-0 ring-0 p-0', body: 'p-0 sm:px-0', header: 'p-0 sm:px-0', }">
    <template #header>
      <div class=" flex items-center gap-3">
        <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
          <UIcon :name="icon" class="w-4 h-4" />
        </div>
        <div>
          <h3 class="font-medium">{{ title }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ description }}</p>
        </div>
      </div>
    </template>
    <div ref="chartRef" class="w-full h-80" />
  </UCard>
</template>
