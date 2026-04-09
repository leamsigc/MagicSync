<script setup lang="ts">
import type { UIMessage } from 'ai'

const props = defineProps<{
  toolCallId: string
  toolName: string
  input: unknown
  output?: string
  error?: string
  state: 'input-available' | 'output-available' | 'error'
}>()

const isExpanded = ref(true)

function formatInput(input: unknown): string {
  if (typeof input === 'object') {
    return JSON.stringify(input, null, 2)
  }
  return String(input)
}
</script>

<template>
  <div class="border border-muted rounded-lg overflow-hidden bg-muted/30 my-2">
    <button class="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
      @click="isExpanded = !isExpanded">
      <UIcon :name="isExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        class="w-4 h-4 text-muted flex-shrink-0" />
      <div class="flex items-center gap-2">
        <UBadge v-if="state === 'output-available'" color="primary" variant="subtle" size="xs">
          <UIcon name="i-lucide-check" class="w-3 h-3 mr-1" />
          Done
        </UBadge>
        <UBadge v-else-if="state === 'error'" color="error" variant="subtle" size="xs">
          <UIcon name="i-lucide-x" class="w-3 h-3 mr-1" />
          Error
        </UBadge>
        <UBadge v-else color="secondary" variant="subtle" size="xs">
          <UIcon name="i-lucide-loader-2" class="w-3 h-3 mr-1 animate-spin" />
          Running
        </UBadge>
        <span class="text-sm font-mono text-foreground">
          {{ toolName }}
        </span>
      </div>
    </button>

    <div v-show="isExpanded" class="px-3 pb-3 space-y-2">
      <div>
        <p class="text-xs text-muted font-semibold mb-1">Input:</p>
        <pre class="text-xs bg-black/10 dark:bg-white/5 rounded p-2 overflow-x-auto">{{ formatInput(input) }}</pre>
      </div>

      <div v-if="output || state === 'output-available'">
        <p class="text-xs text-muted font-semibold mb-1">Output:</p>
        <pre
          class="text-xs bg-green-500/10 dark:bg-green-500/5 rounded p-2 overflow-x-auto border border-green-500/20">{{ output || 'Running...' }}</pre>
      </div>

      <div v-if="error || state === 'error'">
        <p class="text-xs text-muted font-semibold mb-1">Error:</p>
        <pre
          class="text-xs bg-red-500/10 dark:bg-red-500/5 rounded p-2 overflow-x-auto border border-red-500/20 text-red-600 dark:text-red-400">{{ error || 'Unknown error' }}</pre>
      </div>
    </div>
  </div>
</template>
