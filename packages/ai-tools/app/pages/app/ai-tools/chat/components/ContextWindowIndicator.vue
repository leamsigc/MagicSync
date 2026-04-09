<template>
  <div class="context-window-indicator" :class="usage.status">
    <div class="indicator-content">
      <span class="label">{{ t('context') }}:</span>
      <span class="tokens">{{ usage.used.toLocaleString() }}</span>
      <span class="separator">/</span>
      <span class="max">{{ usage.max.toLocaleString() }}</span>
      <span class="percentage">({{ usage.percentage }}%)</span>
    </div>
    <div class="progress-bar">
      <div 
        class="progress-fill" 
        :style="{ width: `${Math.min(usage.percentage, 100)}%` }"
      ></div>
    </div>
    <div v-if="isWarning" class="warning-indicator">
      <span v-if="isCritical" class="warning-icon">⚠️</span>
      <span v-else class="warning-icon">⚡</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useContextWindow } from '../composables/useContextWindow'

const { t } = useI18n()

const { contextUsage: usage, isWarning, isCritical } = useContextWindow()
</script>

<style scoped>
.context-window-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  background: var(--bg-secondary);
}

.indicator-content {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}

.label {
  color: var(--text-muted);
}

.tokens {
  font-weight: 600;
  color: var(--text-primary);
}

.separator {
  color: var(--text-muted);
}

.max {
  color: var(--text-muted);
}

.percentage {
  color: var(--text-muted);
  font-size: 0.65rem;
}

.progress-bar {
  width: 60px;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-radius: 2px;
}

.green .progress-fill {
  background: #22c55e;
}

.yellow .progress-fill {
  background: #eab308;
}

.red .progress-fill {
  background: #ef4444;
}

.green {
  border-left: 2px solid #22c55e;
}

.yellow {
  border-left: 2px solid #eab308;
}

.red {
  border-left: 2px solid #ef4444;
}

.warning-indicator {
  display: flex;
  align-items: center;
}

.warning-icon {
  font-size: 0.875rem;
}

.yellow .warning-icon {
  animation: pulse 2s infinite;
}

.red .warning-icon {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
