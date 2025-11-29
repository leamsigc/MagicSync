<script setup lang="ts">
import { computed } from 'vue'
import contributorsData from 'virtual:contributors'
import type { ContributorInfo } from '../../../metadata/types'

const props = defineProps<{
  fn: string
}>()

const contributors = computed<ContributorInfo[]>(() => {
  // Case-insensitive search
  const fnLower = props.fn.toLowerCase()
  const key = Object.keys(contributorsData).find(k => k.toLowerCase() === fnLower) || props.fn
  const allContributors = contributorsData[key] || []

  // Merge contributors with same email (different Git names)
  const merged = new Map<string, ContributorInfo>()

  for (const contributor of allContributors) {
    const existing = merged.get(contributor.email)
    if (existing) {
      existing.count += contributor.count
      // Preserve GitHub username if found
      if (!existing.github && contributor.github)
        existing.github = contributor.github
    }
    else {
      merged.set(contributor.email, { ...contributor })
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.count - a.count)
})

function getAvatarUrl(contributor: ContributorInfo): string {
  // If GitHub username is available, use GitHub avatar (like VueUse)
  if (contributor.github)
    return `https://avatars.githubusercontent.com/${contributor.github}?v=4`

  // Fallback to Gravatar
  return `https://gravatar.com/avatar/${contributor.hash}?d=retro`
}

function getGithubUrl(contributor: ContributorInfo): string {
  // Use GitHub username if available
  if (contributor.github)
    return `https://github.com/${contributor.github}`

  // Fallback: try to construct from email
  const username = contributor.email.split('@')[0].replace(/[.\-_]/g, '')
  return `https://github.com/${username}`
}
</script>

<template>
  <div class="flex flex-wrap gap-4 pt-2">
    <a
      v-for="c of contributors"
      :key="c.email"
      :href="getGithubUrl(c)"
      target="_blank"
      class="flex gap-2 items-center no-underline text-[var(--vp-c-text-1)] transition-opacity duration-200 hover:opacity-70"
    >
      <img :src="getAvatarUrl(c)" class="w-8 h-8 rounded-full">
      {{ c.name }}
    </a>
  </div>
</template>

<style scoped>
/* Tailwind classes used in template */
</style>
