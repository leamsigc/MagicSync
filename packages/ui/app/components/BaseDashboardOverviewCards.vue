<script lang="ts" setup>
/**
 * Component Description: Dashboard Overview Cards
 *
 * Displays key business metrics and charts in a clean card layout
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test
 * @todo [✔] Update the typescript
 */

interface Metric {
  title: string
  value: string
  icon: string
  color: string
  trend: 'up' | 'down'
  change: string
}

const { displayMetrics } = defineProps<{
  displayMetrics: Metric[]
}>()
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <UCard v-for="metric in displayMetrics" :key="metric.title"
        class="hover:shadow-lg transition-shadow duration-200">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg" :class="metric.color">
            <Icon :name="metric.icon" class="w-5 h-5" />
          </div>
          <UBadge :color="metric.trend === 'up' ? 'success' : 'error'" variant="subtle" class="text-xs">
            <Icon :name="metric.trend === 'up' ? 'lucide:trending-up' : 'lucide:trending-down'" class="w-3 h-3 mr-1" />
            {{ metric.change }}
          </UBadge>
        </div>

        <div class="space-y-1">
          <div class="text-2xl font-bold text-foreground">{{ metric.value }}</div>
          <div class="text-sm text-muted-foreground">{{ metric.title }}</div>
        </div>
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <slot></slot>
    </div>
  </div>
</template>
