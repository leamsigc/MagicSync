<i18n src="../index.json"></i18n>

<script lang="ts" setup>
import { useVideoCropper } from '../composables/useVideoCropper'

const { t } = useI18n()

const { audioTracks, addAudioTrack, removeAudioTrack } = useVideoCropper()

const showForm = ref(false)
const audioTab = ref<'file' | 'url'>('file')
const audioFile = ref<File | null>(null)
const audioUrl = ref('')

function addTrack() {
  if (audioTab.value === 'file' && audioFile.value) {
    addAudioTrack({
      id: `audio-${Date.now()}`,
      name: audioFile.value.name,
      file: audioFile.value,
      loop: false,
      volume: 0.8,
    })
    audioFile.value = null
  } else if (audioTab.value === 'url' && audioUrl.value.trim()) {
    addAudioTrack({
      id: `audio-${Date.now()}`,
      name: audioUrl.value.split('/').pop() || 'Remote Audio',
      url: audioUrl.value.trim(),
      loop: false,
      volume: 0.8,
    })
    audioUrl.value = ''
  }
  showForm.value = false
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.length) audioFile.value = target.files[0] as File
}
</script>

<template>
  <UCard :ui="{ body: 'p-4', root: 'w-full' }">
    <template #header>
      <div class="flex justify-between items-center">
        <h4 class="font-semibold text-xs text-muted uppercase tracking-wider">{{ t('audio.title') }}</h4>
        <UButton color="primary" variant="soft" size="xs" icon="i-lucide-plus" @click="showForm = !showForm">
          {{ t('audio.add_track') }}
        </UButton>
      </div>
    </template>

    <div class="flex flex-col gap-2.5 max-h-55 overflow-y-auto pr-1">
      <p v-if="audioTracks.length === 0" class="text-xs text-dimmed text-center py-4 font-mono">{{ t('audio.no_tracks') }}</p>
      <div
        v-for="track in audioTracks"
        :key="track.id"
        class="flex items-center justify-between bg-default px-3 py-2 rounded-xl border border-default"
      >
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-music" class="w-4 h-4 text-primary" />
          <span class="text-xs font-mono text-highlighted truncate max-w-30">{{ track.name }}</span>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          @click="removeAudioTrack(track.id)"
        />
      </div>
    </div>

    <div v-if="showForm" class="bg-default p-3 rounded-xl border border-default flex flex-col gap-3">
      <div class="flex justify-between items-center pb-1.5 border-b border-default">
        <span class="text-xs font-semibold text-primary">{{ t('audio.new_track') }}</span>
        <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-x" @click="showForm = false" />
      </div>

      <div class="flex gap-1 bg-muted p-1 rounded-lg text-[10px]">
        <UButton
          size="xs"
          :color="audioTab === 'file' ? 'primary' : 'neutral'"
          :variant="audioTab === 'file' ? 'solid' : 'ghost'"
          block
          @click="()=>{audioTab = 'file'}"
        >
          {{ t('audio.local_file') }}
        </UButton>
        <UButton
          size="xs"
          :color="audioTab === 'url' ? 'primary' : 'neutral'"
          :variant="audioTab === 'url' ? 'solid' : 'ghost'"
          block
          @click="()=>{audioTab = 'url'}"
        >
          {{ t('audio.audio_url') }}
        </UButton>
      </div>

      <div v-if="audioTab === 'file'" class="flex flex-col gap-1.5">
        <label class="text-[10px] text-dimmed font-mono">{{ t('audio.select_file') }}</label>
        <div class="bg-muted p-2 rounded-lg border border-default">
          <input type="file" accept="audio/*" class="w-full text-xs text-muted file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" @change="handleFileSelect">
        </div>
      </div>

      <div v-else class="flex flex-col gap-1.5">
        <label class="text-[10px] text-dimmed font-mono">{{ t('audio.url_placeholder') }}</label>
        <UInput v-model="audioUrl" :placeholder="t('audio.url_placeholder')" block size="sm" />
      </div>

      <UButton color="primary" block size="sm" @click="addTrack">
        {{ t('audio.save_track') }}
      </UButton>
    </div>
  </UCard>
</template>
