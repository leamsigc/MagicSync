<template>
  <div class="deep-mode-toggle">
    <label class="toggle-label">
      <input
        type="checkbox"
        :checked="deepModeEnabled"
        @change="toggleDeepMode"
        class="toggle-input"
      />
      <span class="toggle-switch"></span>
      <span class="toggle-text">{{ t('deepMode') }}</span>
    </label>
    <div v-if="deepModeEnabled" class="deep-mode-indicator" :class="agentStatus">
      <span class="status-dot"></span>
      <span class="status-text">{{ agentStatusLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  initialEnabled?: boolean
  initialStatus?: 'idle' | 'planning' | 'executing' | 'waiting' | 'complete' | 'error'
}>()

const emit = defineEmits<{
  (e: 'toggle', enabled: boolean): void
}>()

const deepModeEnabled = ref(props.initialEnabled || false)
const agentStatus = ref(props.initialStatus || 'idle')

const agentStatusLabel = computed(() => {
  const labels: Record<string, string> = {
    idle: 'Ready',
    planning: 'Planning...',
    executing: 'Executing',
    waiting: 'Waiting',
    complete: 'Complete',
    error: 'Error'
  }
  return labels[agentStatus.value] || 'Unknown'
})

function toggleDeepMode() {
  deepModeEnabled.value = !deepModeEnabled.value
  emit('toggle', deepModeEnabled.value)
}

function setStatus(status: typeof agentStatus.value) {
  agentStatus.value = status
}

defineExpose({ setStatus, deepModeEnabled })
</script>

<style scoped>
.deep-mode-toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.toggle-input {
  display: none;
}

.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  background: var(--bg-tertiary);
  border-radius: 10px;
  transition: background 0.2s;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: var(--text-primary);
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-input:checked + .toggle-switch {
  background: var(--color-primary);
}

.toggle-input:checked + .toggle-switch::after {
  transform: translateX(16px);
}

.toggle-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.deep-mode-indicator {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  background: var(--bg-secondary);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}

.planning .status-dot,
.executing .status-dot {
  background: #eab308;
  animation: pulse 1s infinite;
}

.waiting .status-dot {
  background: #3b82f6;
  animation: pulse 2s infinite;
}

.complete .status-dot {
  background: #22c55e;
}

.error .status-dot {
  background: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
