<script setup lang="ts">
import { computed } from 'vue'
import metadata from 'virtual:metadata'

const props = defineProps<{
  fn: string
}>()

const functionData = computed(() => {
  // Case-insensitive search
  const fnLower = props.fn.toLowerCase()
  const found = Object.values(metadata.functions).find(
    f => f.name.toLowerCase() === fnLower,
  )
  return found || metadata.functions[props.fn]
})

const category = computed(() => functionData.value?.category)
const related = computed(() => functionData.value?.related || [])
const lastUpdated = computed(() => {
  const timestamp = functionData.value?.lastUpdated
  if (!timestamp)
    return null
  return formatTimeAgo(timestamp)
})

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ]

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds)
    if (count >= 1)
      return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`
  }

  return 'just now'
}

function getFunctionLink(fn: string) {
  return `/guide/${fn.replace(/([A-Z])/g, '-$1').toLowerCase()}`
}
</script>

<template>
  <div class="grid grid-cols-[100px_auto] gap-2 text-sm mt-4 mb-8 items-start">
    <div class="opacity-50">
      Category
    </div>
    <div><a :href="`/api/#${category?.toLowerCase() || ''}`">{{ category }}</a></div>
    <template v-if="lastUpdated">
      <div class="opacity-50">
        Last Changed
      </div>
      <div>{{ lastUpdated }}</div>
    </template>
    <template v-if="related.length">
      <div class="opacity-50">
        Related
      </div>
      <div class="flex gap-1 flex-wrap">
        <a
          v-for="(name, idx) of related"
          :key="idx"
          :href="getFunctionLink(name)"
          class="!p-0"
        >
          <code class="text-sm">{{ name }}</code>
        </a>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Tailwind classes used in template */
</style>
