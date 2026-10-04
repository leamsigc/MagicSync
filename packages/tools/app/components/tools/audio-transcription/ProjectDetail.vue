<i18n src="#site/app/pages/tools/audio-transcription/index.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: ProjectDetail component to display and edit transcription project details
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import AudioPlayer from './AudioPlayer.vue'

interface Props {
  project: Project
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'update', id: string, updates: Partial<Project>): void
}>()

const { t } = useI18n()

const currentTime = ref(0)
const activeSegment = ref<number | null>(null)
const transcriptRef = ref<HTMLElement | null>(null)

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const handleTimeUpdate = (time: number) => {
  currentTime.value = time

  if (!props.project.segments) return

  const current = props.project.segments.findIndex(s => time >= s.start && time <= s.end)
  if (current !== -1 && current !== activeSegment.value) {
    activeSegment.value = current
  }
}

const handleSegmentClick = (start: number) => {
  const audio = document.querySelector('audio')
  if (audio) {
    audio.currentTime = start
    audio.play()
  }
}

const handleDownload = (format: 'txt' | 'json') => {
  if (!props.project.segments) return

  let content = ''
  let mimeType = ''

  if (format === 'txt') {
    content = props.project.segments.map(s => `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.text}`).join('\n')
    mimeType = 'text/plain'
  } else {
    content = JSON.stringify(props.project.segments, null, 2)
    mimeType = 'application/json'
  }

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.project.filename}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

const handleWordUpdate = (segmentId: number, wordIdx: number, newWord: string) => {
  if (!props.project.segments) return

  const newSegments = props.project.segments.map(s => {
    if (s.id === segmentId) {
      const words = s.text.split(' ')
      words[wordIdx] = newWord
      return { ...s, text: words.join(' ') }
    }
    return s
  })

  emit('update', props.project.id, { segments: newSegments })
}

const editingWord = ref<{ segmentId: number; wordIdx: number } | null>(null)
const editValue = ref('')

const isWordEditing = (segmentId: number, wordIdx: number) => {
  return editingWord.value?.segmentId === segmentId && editingWord.value?.wordIdx === wordIdx
}

const startEditing = (segmentId: number, wordIdx: number, word: string) => {
  editingWord.value = { segmentId, wordIdx }
  editValue.value = word
}

const saveEdit = () => {
  if (!editingWord.value) return
  handleWordUpdate(editingWord.value.segmentId, editingWord.value.wordIdx, editValue.value)
  editingWord.value = null
}

const cancelEdit = () => {
  editingWord.value = null
  editValue.value = ''
}

const isSegmentActive = (index: number) => activeSegment.value === index
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="flex items-center justify-between border-b dark:border-white/5 border-black/10 pb-6">
      <div class="flex items-center gap-4">
        <UButton variant="ghost" size="lg" icon="i-lucide-arrow-left" @click="emit('back')" />
        <div>
          <h2 class="text-2xl font-semibold  flex items-center gap-3">
            {{ project.filename }}
            <span class="text-xs font-medium px-2 py-0.5 rounded-full  text-gray-400 border border-white/10">
              {{ t('audio-transcription.projectDetail.draft') }}
            </span>
          </h2>
          <p class="text-sm text-gray-500 mt-1">{{ t('audio-transcription.projectDetail.draft') }} {{ new
            Date(project.lastModified).toLocaleDateString() }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <UButton variant="soft" color="neutral" icon="i-lucide-save">
          {{ t('audio-transcription.projectDetail.localSave') }}
        </UButton>
        <UDropdownMenu :items="[
          [
            { label: 'Text (.txt)', icon: 'i-lucide-file-text', onSelect: () => handleDownload('txt') },
            { label: 'JSON (.json)', icon: 'i-lucide-braces', onSelect: () => handleDownload('json') }
          ]
        ]">
          <UButton color="primary" variant="soft" icon="i-lucide-download">
            {{ t('audio-transcription.projectDetail.export') }}
          </UButton>
        </UDropdownMenu>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 space-y-8">
        <div class=" border dark:border-white/5 border-black/10 rounded-2xl p-6">
          <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">{{
            t('audio-transcription.projectDetail.audio') }}</h3>
          <ClientOnly>
            <AudioPlayer v-if="project.audioData" :audio-data="project.audioData" :current-time="currentTime"
              @time-update="handleTimeUpdate" />
            <template #fallback>
              <div class="h-24  rounded-xl animate-pulse" />
            </template>
          </ClientOnly>
        </div>

        <div class=" border dark:border-white/5 border-black/10 rounded-2xl p-6">
          <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-6">{{
            t('audio-transcription.projectDetail.transcript') }}</h3>
          <div ref="transcriptRef"
            class="space-y-4 max-h-[500px] overflow-y-auto pr-4 scrollbar-thin  overflow-x-hidden">
            <template v-if="project.segments?.length">
              <div v-for="(segment, idx) in project.segments" :key="segment.id" :id="`segment-${idx}`" :class="[
                'p-4 rounded-xl transition-colors cursor-pointer w-full',
                isSegmentActive(idx)
                  ? 'bg-emerald-500/5 border border-emerald-500/20'
                  : 'hover: border border-transparent'
              ]" @click="handleSegmentClick(segment.start)">
                <div class="flex items-center gap-3 mb-2">
                  <span class="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {{ formatTime(segment.start) }}
                  </span>
                  <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {{ t('audio-transcription.projectDetail.speaker') }} {{ segment.speaker || '1' }}
                  </span>
                </div>
                <p :class="['text-lg leading-relaxed flex flex-wrap', isSegmentActive(idx) ? '' : 'text-gray-300']">
                  <template v-for="(word, wordIdx) in segment.text.split(' ')" :key="wordIdx">
                    <span v-if="isWordEditing(segment.id, wordIdx)">
                      <input v-model="editValue" class="bg-white/10  px-1 rounded outline-none inline-block w-24"
                        @blur="saveEdit" @keydown.enter="saveEdit" @keydown.escape="cancelEdit" autofocus>
                    </span>
                    <span v-else @dblclick.stop="startEditing(segment.id, wordIdx, word)"
                      class="cursor-text hover:bg-white/10 rounded px-0.5 transition-colors">
                      {{ word }}
                    </span>
                    <span v-if="wordIdx < segment.text.split(' ').length - 1"> </span>
                  </template>
                </p>
              </div>

              <div v-if="project.partialText"
                class="p-4 rounded-xl transition-colors hover: border border-transparent opacity-70">
                <div class="flex items-center gap-3 mb-2">
                  <span class="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded animate-pulse">
                    ...
                  </span>
                </div>
                <p class="text-lg leading-relaxed text-gray-300">
                  {{ project.partialText }}
                </p>
              </div>

              <div v-if="project.status === 'processing' || project.status === 'pending'"
                class="flex flex-col items-center justify-center py-6 text-gray-500 animate-pulse">
                <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin mb-2" />
                <p>{{ t('audio-transcription.projectDetail.transcribing') }}</p>
                <p class="text-sm mt-2 text-gray-400">You can safely close this or start another transcription.</p>
              </div>
            </template>

            <template v-else>
              <div v-if="project.status === 'processing' || project.status === 'pending'"
                class="flex flex-col items-center justify-center py-12 text-gray-500 animate-pulse">
                <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin mb-3" />
                <p>{{ t('audio-transcription.projectDetail.starting') }}</p>
                <p class="text-sm mt-2 text-gray-400">You can safely close this or start another transcription.</p>
              </div>
              <div v-else class="text-center py-12 text-gray-500">
                {{ t('audio-transcription.projectDetail.noTranscript') }}
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class=" border dark:border-white/5 border-black/10 rounded-2xl p-6">
          <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">{{
            t('audio-transcription.projectDetail.summary') }}</h3>
          <div v-if="project.summaryStatus === 'processing'" class="animate-pulse space-y-3">
            <div class="h-4  rounded w-3/4"></div>
            <div class="h-4  rounded w-full"></div>
            <div class="h-4  rounded w-5/6"></div>
          </div>
          <div v-else-if="project.summary" class="p-4  rounded-xl border border-transparent">
            <p class="text-sm leading-relaxed ">{{ project.summary }}</p>
          </div>
          <div v-else class="text-sm text-gray-500">
            {{ t('audio-transcription.projectDetail.summaryPlaceholder') }}
          </div>
        </div>

        <div class=" border dark:border-white/5 border-black/10 rounded-2xl p-6">
          <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">{{
            t('audio-transcription.projectDetail.engine') }}</h3>
          <div class="space-y-4">
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-500">{{ t('audio-transcription.model') }}</span>
              <span class=" font-medium">{{ project.engine.split('/').pop() }}</span>
            </div>
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-500">{{ t('audio-transcription.language') }}</span>
              <span class=" font-medium capitalize">{{ project.language }}</span>
            </div>
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-500">{{ t('audio-transcription.recentProjects.status') }}</span>
              <span class="flex items-center gap-1.5 text-emerald-400 font-medium">
                <UIcon name="i-lucide-check-circle" class="w-4 h-4" />
                {{ t(`audio-transcription.status.${project.status}`) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
