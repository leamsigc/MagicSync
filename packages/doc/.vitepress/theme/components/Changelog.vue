<script setup lang="ts">
import type { CommitInfo } from '../../../metadata/types'
import { computed } from 'vue'
import ChangelogEntry from './ChangelogEntry.vue'
import changelogData from 'virtual:changelog'

const props = defineProps<{ fn: string }>()

// Case-insensitive search for changelog data
const fnLower = props.fn.toLowerCase()
const key = Object.keys(changelogData).find(k => k.toLowerCase() === fnLower) || props.fn
const allCommits = (changelogData[key] || []) as CommitInfo[]

const commits = computed(() => {
  // VueUse logic: Filter out version tags that have no commits after them
  // (i.e., consecutive version tags where the second one should be hidden)
  return allCommits.filter((i, idx) => {
    // If this is a version AND the next item is also a version, hide this one
    if (i.version && allCommits[idx + 1]?.version)
      return false
    return true
  })
})
</script>

<template>
  <em v-if="!commits.length" class="opacity-70">No recent changes</em>

  <div class="grid grid-cols-[28px_1fr] gap-y-2 gap-x-3 relative items-center pl-[6px] [&>*]:flex [&>*]:items-center before:content-[''] before:absolute before:left-[20px] before:top-0 before:bottom-0 before:w-[1px] before:bg-[var(--vp-c-divider)] before:opacity-30 before:z-0">
    <ChangelogEntry
      v-for="(commit, idx) of commits"
      :key="commit.hash"
      :pending="idx === 0"
      :commit="commit"
      :function-name="fn"
    />
  </div>
</template>

<style scoped>
/* Tailwind classes used in template */
</style>
