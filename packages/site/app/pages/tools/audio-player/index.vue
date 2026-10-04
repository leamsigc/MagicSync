<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 * Audio Player Tool
 * Play audio files with waveform visualization
 *
 * @author Local Monorepo Team
 * @version 0.0.1
 */



const { t } = useI18n()

useHead({
  title: () => t('title'),
  meta: [
    { name: 'description', content: () => t('description') }
  ]
})

defineOgImage('BlogOgImage', {
  title: t('title'),
  description: t('description'),
  headline: 'Free Tools',
  imageUrl: '/img/audio-player.png',
})

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const audioData = ref<ArrayBuffer | null>(null)
const currentTime = ref(0)

const handleFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) {
    const file = input.files[0]
    selectedFile.value = file
    audioData.value = await file.arrayBuffer()
    currentTime.value = 0
  }
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('audio/')) {
    selectedFile.value = file
    audioData.value = await file.arrayBuffer()
    currentTime.value = 0
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const clearFile = () => {
  selectedFile.value = null
  audioData.value = null
  currentTime.value = 0
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const handleTimeUpdate = (time: number) => {
  currentTime.value = time
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <BaseHeader />
    <main class="container mx-auto px-4 py-8 max-w-5xl">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-highlighted mb-2">{{ t('app_title') }}</h1>
        <p class="text-muted">{{ t('description') }}</p>
      </div>

      <div class="mb-8">
        <div
          class="border-2 border-dashed border-accented rounded-xl p-12 text-center cursor-pointer transition-colors hover:border-primary hover:bg-primary/5"
          @click="fileInputRef?.click()" @drop="handleDrop" @dragover="handleDragOver">
          <input ref="fileInputRef" type="file" accept="audio/*" class="hidden" @change="handleFileSelect">
          <UIcon name="i-lucide-music" class="w-12 h-12 text-dimmed mx-auto mb-4" />
          <p class="text-lg text-toned mb-2">{{ t('drop_here') }}</p>
          <p class="text-sm text-dimmed">{{ t('supported_formats') }}</p>
        </div>

        <div v-if="selectedFile" class="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-file-audio" class="w-6 h-6 text-primary" />
              <div>
                <p class="text-sm font-medium text-highlighted">{{ selectedFile.name }}</p>
                <p class="text-xs text-dimmed">{{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</p>
              </div>
            </div>
            <UButton variant="ghost" size="sm" icon="i-lucide-x" data-testid="audio-clear-file" @click="clearFile" />
          </div>
        </div>
      </div>

      <AudioPlayer v-if="audioData" :audio-data="audioData" :current-time="currentTime" container-class="h-80"
        class="h-96" @time-update="handleTimeUpdate" />

      <div v-else class="border border-default rounded-2xl p-12 text-center">
        <UIcon name="i-lucide-headphones" class="w-16 h-16 text-dimmed mx-auto mb-4" />
        <p class="text-dimmed">{{ t('upload_to_start') }}</p>
      </div>

      <div class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <BaseShinyCard>
          <UCard
            class="bg-elevated/60 hover:bg-accented/60 transition-all delay-75 group/number h-full">
            <template #header>
              <div class="flex justify-between">
                <Icon class="size-8 mb-6 text-primary" name="i-lucide-audio-waveform" />

                <span
                  class="text-5xl text-highlighted/15 font-medium transition-all delay-75 group-hover/number:text-highlighted/30">
                  01
                </span>
              </div>

              <h2>{{ t('feature_player') }}</h2>
            </template>

            <section class="text-muted">
              {{ t('feature_player_desc') }}
            </section>
          </UCard>
        </BaseShinyCard>
        <BaseShinyCard>
          <UCard
            class="bg-elevated/60 hover:bg-accented/60 transition-all delay-75 group/number h-full">
            <template #header>
              <div class="flex justify-between">
                <Icon class="size-8 mb-6 text-primary" name="i-lucide-sliders" />
                <span
                  class="text-5xl text-highlighted/15 font-medium transition-all delay-75 group-hover/number:text-highlighted/30">
                  02
                </span>
              </div>

              <h2>{{ t('feature_controls') }}</h2>
            </template>

            <section class="text-muted">
              {{ t('feature_controls_desc') }}
            </section>
          </UCard>

        </BaseShinyCard>
        <BaseShinyCard>
          <UCard
            class="bg-elevated/60 hover:bg-accented/60 transition-all delay-75 group/number h-full">
            <template #header>
              <div class="flex justify-between">
                <Icon class="size-8 mb-6 text-primary" name="i-lucide-file-audio" />
                <span
                  class="text-5xl text-highlighted/15 font-medium transition-all delay-75 group-hover/number:text-highlighted/30">
                  03
                </span>
              </div>

              <h2>{{ t('feature_local') }}</h2>
            </template>

            <section class="text-muted">
              {{ t('feature_local_desc') }}
            </section>
          </UCard>
        </BaseShinyCard>
      </div>
    </main>
    <BaseFooter />
  </div>
</template>
