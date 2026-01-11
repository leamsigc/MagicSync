<i18n>
{
  "en": {
    "preview": {
      "title": "Generation Preview",
      "postNumber": "Post #{number}"
    }
  },
  "es": {
    "preview": {
      "title": "Vista Previa de Generación",
      "postNumber": "Publicación #{number}"
    }
  }
}
</i18n>

<script lang="ts" setup>
import { computed } from 'vue'
import { processTemplate } from '../../utils/templateProcessor'
import { distributePostsAcrossDates } from '../../utils/dateDistribution'

interface Props {
  template: string
  contentRows: Record<string, string>[]
  platforms: string[]
  dateRange: { startDate: Date; endDate: Date }
  skipWeekends?: boolean
  businessHoursOnly?: boolean
}
const { t } = useI18n()
const props = defineProps<Props>()

const previewPosts = computed(() => {
  if (!props.template || props.contentRows.length === 0 || !props.dateRange.startDate) {
    return []
  }

  const totalPosts = props.contentRows.length
  const distributedDates = distributePostsAcrossDates(totalPosts, {
    startDate: props.dateRange.startDate,
    endDate: props.dateRange.endDate,
    postsPerDay: 1, // Not used for total count here
    skipWeekends: props.skipWeekends,
    businessHoursOnly: props.businessHoursOnly
  })

  return props.contentRows.map((row, index) => {
    const dist = distributedDates[index]
    const variables = Object.entries(row).map(([key, value]) => ({ key, value }))

    if (dist) {
      variables.push(
        { key: 'date', value: dist.date.toLocaleDateString() },
        { key: 'time', value: dist.date.toLocaleTimeString() },
        { key: 'day', value: dist.date.toLocaleDateString('en-US', { weekday: 'long' }) }
      )
    }

    const processed = processTemplate(props.template, {
      variables,
      strict: false
    })

    return {
      content: processed.content,
      scheduledAt: dist?.date
    }
  })
})
</script>

<template>
  <UCard v-if="previewPosts.length > 0">
    <template #header>
      <h3 class="text-lg font-semibold">{{ t('preview.title') }}</h3>
    </template>

    <div class="space-y-4 max-h-[600px] overflow-y-auto pr-2">
      <div v-for="(post, index) in previewPosts" :key="index" class="p-3 space-y-2">
        <div class="flex items-center justify-between text-xs text-zinc-200">
          <span class="font-medium">{{ t('preview.postNumber', { number: index + 1 }) }}</span>
          <span v-if="post.scheduledAt">
            {{ post.scheduledAt.toLocaleString() }}
          </span>
        </div>

        <p class="text-sm whitespace-pre-wrap  font-sans leading-relaxed">
          {{ post.content }}
        </p>

        <div class="flex gap-1.5 pt-1">
          <Icon v-for="platform in platforms" :key="platform" :name="`logos:${platform.toLowerCase()}`"
            class="w-3.5 h-3.5 opacity-60" />
        </div>
      </div>
    </div>
  </UCard>
</template>
