<!--  Translation file -->
<i18n src="#site/app/pages/tools/audio-transcription/index.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: RecentProjects component to display list of transcription projects
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */


interface Props {
  projects: Project[]
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'delete', id: string): void
  (e: 'stop', id: string): void
}>()

const { t } = useI18n()

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString()
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    case 'processing':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'error':
      return 'bg-red-500/10 text-red-400 border-red-500/20'
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }
}

const getStatusLabel = (status: string): string => {
  return t(`audio-transcription.status.${status}`) || status
}
</script>

<template>
  <div class=" border border-black/10 dark:border-white/5 rounded-2xl overflow-hidden">
    <div class="p-6 border-b border-black/10 dark:border-white/5">
      <h2 class="text-xl font-semibold ">{{ t('audio-transcription.recentProjects.title') }}</h2>
      <p class="text-sm  mt-1">{{ t('audio-transcription.recentProjects.subtitle') }}</p>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="text-xs  uppercase ">
          <tr>
            <th class="px-6 py-4 font-medium">{{ t('audio-transcription.recentProjects.fileName') }}</th>
            <th class="px-6 py-4 font-medium">{{ t('audio-transcription.recentProjects.length') }}</th>
            <th class="px-6 py-4 font-medium">{{ t('audio-transcription.recentProjects.status') }}</th>
            <th class="px-6 py-4 font-medium">{{ t('audio-transcription.recentProjects.engine') }}</th>
            <th class="px-6 py-4 font-medium">{{ t('audio-transcription.recentProjects.lastModified') }}</th>
            <th class="px-6 py-4 font-medium text-right">{{ t('audio-transcription.recentProjects.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y dark:divide-white/5 divide-black/5">
          <tr v-for="project in projects" :key="project.id"
            class="dark:hover:bg-white/2 hover:bg-black/10 transition-colors cursor-pointer group"
            @click="$emit('select', project.id)">
            <td class="px-6 py-4 font-medium  flex items-center gap-3">
              <UIcon name="i-lucide-file-audio" class="w-4 h-4 text-gray-400 shrink-0" />
              <span class="truncate max-w-[200px]">{{ project.filename }}</span>
            </td>
            <td class="px-6 py-4 text-gray-400">{{ formatTime(project.length) }}</td>
            <td class="px-6 py-4">
              <span :class="['px-2.5 py-1 rounded-full text-xs font-medium border', getStatusColor(project.status)]">
                {{ getStatusLabel(project.status) }}
              </span>
            </td>
            <td class="px-6 py-4 text-gray-400">{{ project.engine.split('/').pop() }}</td>
            <td class="px-6 py-4 text-gray-400">
              {{ formatDate(project.lastModified) }}
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <UButton v-if="project.status === 'processing'" color="error" variant="ghost" size="sm"
                  icon="i-lucide-square" @click="(e: Event) => { e.stopPropagation(); $emit('stop', project.id) }" />
                <template v-else>
                  <UButton variant="ghost" size="sm" icon="i-lucide-external-link"
                    @click="$emit('select', project.id)" />
                  <UButton variant="ghost" size="sm" color="error" icon="i-lucide-trash-2"
                    @click="(e: Event) => { e.stopPropagation(); $emit('delete', project.id) }" />
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="projects.length === 0" class="p-12 text-center ">
      <UIcon name="i-lucide-folder-open" class="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>{{ t('audio-transcription.recentProjects.empty') }}</p>
    </div>
  </div>
</template>
