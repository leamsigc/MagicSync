<script lang="ts" setup>
import { useGMBManager } from './composables/useGMBManager'

const route = useRoute()
const businessId = route.params.id as string
const { t } = useI18n()
const toast = useToast()

const { isLoading, getAnalytics, locations, getLocations } = useGMBManager()

const analyticsData = ref<any[]>([])
const selectedDays = ref(30)
const selectedLocation = ref<string>('')

const loadAnalytics = async () => {
  if (!selectedLocation.value && !locations.value.length) return
  const locName = selectedLocation.value || undefined
  try {
    const result = await getAnalytics(businessId, locName, selectedDays.value)
    if (result?.success) {
      analyticsData.value = result.data || []
    }
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.message || 'Failed to load analytics', color: 'error' })
  }
}

onMounted(async () => {
  try {
    await getLocations(businessId)
    if (locations.value.length) {
      selectedLocation.value = locations.value[0]?.id || ''
    }
    await loadAnalytics()
  } catch {
    // silent
  }
})

watch(selectedDays, () => loadAnalytics())
watch(selectedLocation, () => loadAnalytics())

const getTotalImpressions = (data: any) => {
  if (!data?.data?.length) return 0
  return data.data.reduce((sum: number, d: any) => sum + (d.total || 0), 0)
}

useHead({
  title: 'GMB Analytics',
})
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Analytics & Insights</h1>
        <p class="text-gray-500">Performance data from Google Business Profile</p>
      </div>
      <div class="flex gap-3 items-center">
        <USelect v-if="locations.length" v-model="selectedLocation"
          :options="locations.map((l: any) => ({ label: l.name, value: l.id }))"
          class="w-64" />
        <USelect v-model="selectedDays" :options="[
          { label: 'Last 7 days', value: 7 },
          { label: 'Last 30 days', value: 30 },
          { label: 'Last 90 days', value: 90 },
        ]" class="w-40" />
      </div>
    </div>

    <div v-if="isLoading && !analyticsData.length" class="flex justify-center py-12">
      <UProgress indicator />
    </div>

    <div v-for="(metric, idx) in analyticsData" :key="idx">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">{{ metric.label }}</h3>
            <span class="text-sm text-gray-500">
              Total: {{ getTotalImpressions(metric) }}
              <span v-if="metric.percentageChange" :class="metric.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'">
                ({{ metric.percentageChange >= 0 ? '+' : '' }}{{ metric.percentageChange }}%)
              </span>
            </span>
          </div>
        </template>
        <div v-if="metric.data?.length">
          <div class="space-y-2">
            <div v-for="point in metric.data.slice(-14)" :key="point.date" class="flex items-center gap-3">
              <span class="text-xs text-gray-500 w-24">{{ point.date }}</span>
              <div class="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div class="bg-primary-500 h-full rounded-full transition-all" :style="{ width: Math.min((point.total / Math.max(...metric.data.map((d: any) => d.total))) * 100, 100) + '%' }"></div>
              </div>
              <span class="text-sm font-mono w-16 text-right">{{ point.total }}</span>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-6 text-gray-500">
          No analytics data available for this period.
        </div>
      </UCard>
    </div>

    <div v-if="!analyticsData.length && !isLoading" class="text-center py-12">
      <p class="text-gray-500">No analytics data available. Make sure your location has search impressions data.</p>
    </div>
  </div>
</template>
