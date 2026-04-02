<script setup lang="ts">
import { useContextWindow } from '~/composables/useContextWindow'

const { usage, config, usagePercentage, statusColor, isWarning, isCritical } = useContextWindow()

function formatNumber(num: number): string {
  return num.toLocaleString()
}
</script>

<template>
  <div class="flex items-center gap-2 text-sm">
    <div class="flex items-center gap-1">
      <span class="text-gray-500">Tokens:</span>
      <span :class="{
        'text-green-600': statusColor === 'green',
        'text-yellow-600': statusColor === 'yellow',
        'text-red-600': statusColor === 'red'
      }">
        {{ formatNumber(usage.totalTokens) }}
      </span>
      <span class="text-gray-400">/ {{ formatNumber(config.contextLimit) }}</span>
    </div>
    
    <div class="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div 
        class="h-full transition-all duration-300"
        :class="{
          'bg-green-500': statusColor === 'green',
          'bg-yellow-500': statusColor === 'yellow',
          'bg-red-500': statusColor === 'red'
        }"
        :style="{ width: `${Math.min(usagePercentage, 100)}%` }"
      />
    </div>
    
    <span 
      class="text-xs font-medium"
      :class="{
        'text-green-600': statusColor === 'green',
        'text-yellow-600': statusColor === 'yellow',
        'text-red-600': statusColor === 'red'
      }"
    >
      {{ usagePercentage.toFixed(1) }}%
    </span>
    
    <span 
      v-if="isWarning" 
      class="text-xs text-yellow-600"
    >
      ⚠️ Approaching limit
    </span>
    <span 
      v-if="isCritical" 
      class="text-xs text-red-600"
    >
      🚨 Context limit
    </span>
  </div>
</template>