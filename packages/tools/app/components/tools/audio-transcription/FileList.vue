<script setup lang="ts">
/**
 *
 * Component Description: Displays the list of transcribed/processing audio files
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

defineProps<{
  files: Readonly<TranscriptionFile[]>
  inputSource: 'file' | 'url' | 'record'
  viewMode?: 'list' | 'grid'
  currentModel?: string
}>()

const emit = defineEmits<{
  (e: 'update:inputSource', source: 'file' | 'url' | 'record'): void
  (e: 'select', file: TranscriptionFile): void
  (e: 'transcribe' | 'abort', id: string): void
}>()

function formatDuration(seconds: number) {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<template>
  <div v-motion-fade>
    <!-- Table / List View -->
    <div v-if="viewMode === 'list' || !viewMode"
      class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">File Name
            </th>
            <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Length
            </th>
            <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status
            </th>
            <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Engine
            </th>
            <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last
              Modified</th>
            <th
              class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
              Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
          <tr v-for="file in files" :key="file.id" :class="[
            'group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer',
            file.status === 'transcribing' ? 'bg-primary-50 dark:bg-primary-900/10 hover:bg-primary-100 dark:hover:bg-primary-900/20' : ''
          ]" @click="emit('select', file)">
            <td class="px-6 py-5">
              <div class="flex items-center gap-3">
                <UIcon :name="file.status === 'transcribing' ? 'i-lucide-activity' : 'i-lucide-file-audio'" :class="[
                  'text-xl',
                  file.status === 'transcribing' ? 'text-primary-500 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
                ]" />
                <span class="font-bold tracking-tight text-gray-900 dark:text-gray-100">{{ file.name }}</span>
              </div>
            </td>
            <td class="px-6 py-5 text-gray-500 dark:text-gray-400 font-mono text-sm">
              {{ file.result?.chunks ? formatDuration(file.result.chunks[file.result.chunks.length - 1]?.end ?? 0) :
                '--:--'
              }}
            </td>
            <td class="px-6 py-5">
              <div v-if="file.status === 'transcribing'" class="flex items-center gap-3 w-48">
                <UProgress :model-value="file.progress" color="primary" class="flex-1" />
                <span class="text-[10px] font-bold text-primary-500 dark:text-primary-400 tracking-widest">{{
                  file.progress }}%</span>
              </div>
              <UBadge v-else-if="file.status === 'done'" color="primary" variant="soft"
                class="uppercase tracking-widest text-[10px] font-bold">Completed</UBadge>
              <UBadge v-else-if="file.status === 'error'" color="error" variant="soft"
                class="uppercase tracking-widest text-[10px] font-bold">Error</UBadge>
              <UBadge v-else color="neutral" variant="soft" class="uppercase tracking-widest text-[10px] font-bold">
                Pending
              </UBadge>
            </td>
            <td class="px-6 py-5 text-gray-500 dark:text-gray-400 text-xs font-mono font-medium">Whisper {{ currentModel
              || 'v2-Large' }}</td>
            <td class="px-6 py-5 text-gray-500 dark:text-gray-400 text-sm">Just now</td>
            <td class="px-6 py-5 text-right">
              <UButton v-if="file.status === 'transcribing'" color="error" variant="ghost" icon="i-lucide-square"
                size="sm" @click.stop="emit('abort', file.id)" />
              <UButton v-else-if="file.status === 'done'" color="neutral" variant="ghost" icon="i-lucide-external-link"
                size="sm" @click.stop="emit('select', file)" />
              <UButton v-else color="primary" variant="ghost" icon="i-lucide-play" size="sm"
                @click.stop="emit('transcribe', file.id)" />
            </td>
          </tr>
          <tr v-if="files.length === 0">
            <td colspan="6" class="px-6 py-24 text-center text-gray-500 dark:text-gray-400">
              <div class="flex flex-col items-center gap-4">
                <UIcon name="i-lucide-audio-lines" class="text-5xl opacity-20" />
                <p class="font-medium text-lg text-gray-600 dark:text-gray-300 tracking-tight">No transcripts found</p>
                <p class="text-sm">Start by uploading or recording an audio file.</p>
                <UButton color="primary" class="mt-4" icon="i-lucide-plus" @click="emit('update:inputSource', 'file')">
                  New Transcription
                </UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Grid View -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="file in files" :key="file.id" :class="[
        'flex flex-col p-5 bg-white dark:bg-gray-900 border rounded-2xl transition-all cursor-pointer group hover:-translate-y-1 hover:shadow-xl hover:shadow-primary-500/5',
        file.status === 'transcribing' ? 'border-primary-500/50 dark:border-primary-400/50 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-800'
      ]" @click="emit('select', file)">
        <div class="flex items-start justify-between mb-4">
          <div :class="[
            'p-2.5 rounded-xl',
            file.status === 'transcribing' ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-100 dark:bg-gray-800'
          ]">
            <UIcon :name="file.status === 'transcribing' ? 'i-lucide-activity' : 'i-lucide-file-audio'" :class="[
              'text-2xl',
              file.status === 'transcribing' ? 'text-primary-500 dark:text-primary-400 animate-pulse' : 'text-gray-500 dark:text-gray-400'
            ]" />
          </div>
          <UBadge v-if="file.status === 'done'" color="primary" variant="soft"
            class="uppercase tracking-widest text-[10px] font-bold">Done</UBadge>
          <UBadge v-else-if="file.status === 'error'" color="error" variant="soft"
            class="uppercase tracking-widest text-[10px] font-bold">Error</UBadge>
          <UBadge v-else-if="file.status === 'transcribing'" color="primary" variant="soft"
            class="uppercase tracking-widest text-[10px] font-bold animate-pulse">Processing</UBadge>
          <UBadge v-else color="neutral" variant="soft" class="uppercase tracking-widest text-[10px] font-bold">Pending
          </UBadge>
        </div>

        <h3 class="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100 mb-1 line-clamp-1 truncate"
          :title="file.name">{{ file.name }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-6 font-mono">Whisper {{ currentModel || 'v2-Large' }} • {{
          file.result?.chunks ?
            formatDuration(file.result.chunks[file.result.chunks.length - 1]?.end ?? 0) : '--:--' }}</p>

        <div class="mt-auto">
          <div v-if="file.status === 'transcribing'" class="flex flex-col gap-2">
            <div class="flex justify-between items-center w-full">
              <span
                class="text-[10px] font-bold text-primary-500 dark:text-primary-400 tracking-widest uppercase">Progress</span>
              <span class="text-[10px] font-bold text-primary-500 dark:text-primary-400 tracking-widest">{{
                file.progress }}%</span>
            </div>
            <UProgress :model-value="file.progress" color="primary" class="w-full mb-2" />
            <UButton color="error" variant="solid" size="sm" icon="i-lucide-square"
              class="rounded-lg shadow-lg shadow-red-500/20 px-4 w-full flex justify-center"
              @click.stop="emit('abort', file.id)">
              Stop
            </UButton>
          </div>
          <div v-else class="flex justify-between items-center w-full">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Just now</span>
            <UButton v-if="file.status === 'done'" color="neutral" variant="soft" size="sm"
              class="rounded-lg font-bold px-4" @click.stop="emit('select', file)">
              View
            </UButton>
            <UButton v-else color="primary" variant="solid" size="sm" icon="i-lucide-play"
              class="rounded-lg shadow-lg shadow-primary-500/20 px-4" @click.stop="emit('transcribe', file.id)">
              Generate
            </UButton>
          </div>
        </div>
      </div>

      <div v-if="files.length === 0"
        class="col-span-full border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col items-center justify-center py-24 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors cursor-pointer"
        @click="emit('update:inputSource', 'file')">
        <UIcon name="i-lucide-layer-plus" class="text-4xl text-gray-400 dark:text-gray-500 mb-4" />
        <p class="font-medium text-lg text-gray-600 dark:text-gray-300 tracking-tight">Create your first project</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Upload or record audio</p>
      </div>
    </div>
  </div>
</template>
