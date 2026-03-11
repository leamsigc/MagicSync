<!--  Translation file -->
<i18n src="./create.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: Content Pipeline page — From idea to published. Full script/hook workflow with AI health check and teleprompter focus mode.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.3
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const { t } = useI18n()

const {
  ideas,
  topic,
  hooks,
  selectedHook,
  scriptContent,
  isAddingHook,
  newHook,
  hookHealth,
  aspectRatio,
  isFocusMode,
  isCameraActive,
  isRecording,
  previewUrl,
  timer,
  currentWordIndex,
  isAutoScroll,
  speedMultiplier,
  editChecklist,
  videoUrl,
  words,
  lines,
  WORDS_PER_LINE,
  formatTime,
  handleHookSelect,
  handleAddCustomHook,
  acceptImprovedScript,
} = useContentPipeline()

const {
  isCheckingHealth,
  isSaving,
  isPublishing,
  checkHookHealth,
  saveDraft,
  markAsPublished,
} = useContentPipelineManagement()

// Video recorder composable using mediabunny for high-quality MP4 output
const {
  isCameraActive: isVideoCameraActive,
  isRecording: isVideoRecording,
  isProcessing: isVideoProcessing,
  recordingState,
  countdown,
  isCountingDown,
  timer: videoTimer,
  error: videoError,
  startCamera,
  stopCamera,
  startCountdown,
  startRecording,
  stopRecording,
  downloadVideo,
  clearVideo,
  setAspectRatio,
  reset: resetVideoRecorder,
  frameRate,
  previewUrl: videoPreviewUrl,
  updateTeleprompterText,
} = useVideoRecorder()

// Refs for video and canvas elements
const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Sync aspect ratio with video recorder
watch(aspectRatio, (newRatio) => {
  setAspectRatio(newRatio)
}, { immediate: true })

// Sync preview URL from video recorder composable
watch(() => previewUrl.value, (newUrl) => {
  // This is handled by the composable returning previewUrl directly
}, { immediate: true })

let timerInterval: ReturnType<typeof setInterval> | null = null
let scrollTimeout: ReturnType<typeof setTimeout> | null = null
let countdownInterval: ReturnType<typeof setInterval> | null = null

// Sync timer with video recorder
watch(videoTimer, (newTimer) => {
  timer.value = newTimer
}, { immediate: true })

// Watch for recording state changes from the composable
watch(isVideoRecording, (recording: boolean) => {
  isRecording.value = recording
  if (recording) {
    timerInterval = setInterval(() => { timer.value++ }, 1000)
  } else {
    if (timerInterval) clearInterval(timerInterval)
    isAutoScroll.value = false
  }
})

// Update teleprompter text on canvas during recording
watch(currentWordIndex, () => {
  if (words.value.length > 0) {
    const lineIndex = Math.floor(currentWordIndex.value / WORDS_PER_LINE)
    const line = lines.value[lineIndex] || []
    const next = lines.value[lineIndex + 1] || []
    const wordIdxInLine = currentWordIndex.value % WORDS_PER_LINE
    if (line.length > 0) {
      updateTeleprompterText(line, wordIdxInLine, next.join(' '))
    }
  }
}, { immediate: true })

watch([isRecording, isAutoScroll, currentWordIndex, speedMultiplier], () => {
  if (scrollTimeout) clearTimeout(scrollTimeout)

  const shouldScroll = isRecording.value && isAutoScroll.value && currentWordIndex.value < words.value.length - 1
  if (!shouldScroll) return

  const word = words.value[currentWordIndex.value] || ''
  const lengthFactor = Math.max(0.5, Math.min(2, word.length / 5))
  let duration = 350 * lengthFactor
  if (word.match(/[.,!?:]$/)) duration += 400
  duration = duration / speedMultiplier.value

  scrollTimeout = setTimeout(() => {
    currentWordIndex.value = Math.min(words.value.length - 1, currentWordIndex.value + 1)
  }, duration)
}, { deep: true })

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  if (scrollTimeout) clearTimeout(scrollTimeout)
  if (countdownInterval) clearInterval(countdownInterval)
  stopCamera()
})

// Remove old MediaRecorder-based functions - now handled by useVideoRecorder composable

const enterFocusMode = async () => {
  isFocusMode.value = true
  countdown.value = 0
  isCountingDown.value = false

  resetVideoRecorder()
  await nextTick()
  // Start camera using the new composable
  await startCamera(videoRef.value!, canvasRef.value!)
}

const exitFocusMode = () => {
  countdown.value = 0
  isCountingDown.value = false
  if (isVideoRecording.value) {
    stopRecording()
  }
  stopCamera()
  // resetVideoRecorder()
  isFocusMode.value = false
}

// Wrapper to start recording with countdown
const startRecordingWithCountdown = async () => {
  if (!canvasRef.value) return

  // Use the composable's countdown
  startCountdown(async () => {
    // Reset word index and start auto-scroll
    currentWordIndex.value = 0
    isAutoScroll.value = true

    // Start recording using mediabunny
    await startRecording()
  })
}

const onCheckHookHealth = async () => {
  const result = await checkHookHealth(topic.value, selectedHook.value, hooks.value, scriptContent.value)
  if (result) hookHealth.value = result
}

const onSaveDraft = () =>
  saveDraft({ topic: topic.value, script: scriptContent.value, hook: selectedHook.value.name, ideas: ideas.value })

const onMarkAsPublished = () => markAsPublished(videoUrl.value)

const currentLineIndex = computed(() => Math.floor(currentWordIndex.value / WORDS_PER_LINE))
const currentLine = computed(() => lines.value[currentLineIndex.value] ?? [])
const nextLine = computed(() => lines.value[currentLineIndex.value + 1] ?? [])

useHead({
  title: t('title'),
  meta: [
    { name: 'description', content: t('subtitle') }
  ]
})
</script>

<template>
  <div class="container mx-auto py-6 space-y-8">
    <BasePageHeader :title="t('title')" :description="t('subtitle')">
      <template #actions>
        <UButton :loading="isSaving" icon="i-lucide-save" color="neutral" variant="outline" @click="onSaveDraft">
          {{ t('saveDraft') }}
        </UButton>
      </template>
    </BasePageHeader>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div class="space-y-8">
        <section class="space-y-6">
          <div class="flex justify-between items-center">
            <h2 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span
                class="bg-primary text-primary-foreground w-6 h-6 flex items-center justify-center rounded text-xs">1</span>
              {{ t('script.title') }}
            </h2>
            <span class="text-xs font-mono text-muted-foreground">{{ t('script.duration30m') }}</span>
          </div>

          <div class="space-y-6">
            <div class="space-y-2">
              <label class="block text-xs font-mono text-muted-foreground uppercase">{{
                t('script.topicLabel') }}</label>
              <UInput v-model="topic" :placeholder="t('script.topicPlaceholder')" block class="w-full" />
            </div>

            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <label class="text-xs font-mono text-muted-foreground uppercase">{{
                  t('script.hookLabel') }}</label>
                <UButton color="neutral" variant="ghost" size="xs" @click="isAddingHook = !isAddingHook">
                  {{ t('script.customHook') }}
                </UButton>
              </div>

              <div v-if="isAddingHook" class="p-4 bg-muted border border-border rounded-lg space-y-3">
                <UInput v-model="newHook.name" :placeholder="t('script.hookNamePlaceholder')" block />
                <UInput v-model="newHook.template" :placeholder="t('script.hookTemplatePlaceholder')" block />
                <UButton :disabled="!newHook.name || !newHook.template" color="primary" block
                  @click="handleAddCustomHook">
                  {{ t('script.addHook') }}
                </UButton>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <UButton v-for="hook in hooks" :key="hook.id" color="neutral"
                  :variant="selectedHook.id === hook.id ? 'soft' : 'outline'" block
                  class="flex flex-col items-start p-3 h-auto text-left" @click="handleHookSelect(hook)">
                  <div class="font-bold text-sm">{{ hook.name }}</div>
                  <div class="flex justify-between w-full text-[10px] font-mono opacity-70 mt-1">
                    <span>{{ hook.usage }}</span>
                    <span>{{ hook.successRate }}% Win</span>
                  </div>
                </UButton>
              </div>
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-mono text-muted-foreground uppercase">{{
                t('script.scriptLabel') }}</label>
              <UTextarea v-model="scriptContent" :rows="12" block variant="subtle"
                class="font-mono leading-relaxed w-full" :placeholder="t('script.scriptLabel')" />
            </div>

            <UButton :loading="isCheckingHealth" :disabled="!scriptContent || !topic" block size="lg"
              icon="i-lucide-zap" @click="onCheckHookHealth">
              {{ t('script.checkHealth') }}
            </UButton>

            <UCard v-if="hookHealth" class="border-primary/20">
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-mono text-muted-foreground uppercase">{{
                    t('script.overallScore') }}</h3>
                  <UBadge size="lg" color="primary" variant="subtle">{{ hookHealth.overallScore }}/100
                  </UBadge>
                </div>
              </template>

              <div class="space-y-4 py-2">
                <div class="space-y-2">
                  <div class="flex justify-between text-xs font-mono">
                    <span class="text-muted-foreground">{{
                      t('script.metrics.hookStrength')
                      }}</span>
                    <span>{{ hookHealth.metrics.hookStrength }}%</span>
                  </div>
                  <UProgress :value="hookHealth.metrics.hookStrength" size="xs" color="primary" />
                </div>
                <div class="space-y-2">
                  <div class="flex justify-between text-xs font-mono">
                    <span class="text-muted-foreground">{{
                      t('script.metrics.topicRelevance') }}</span>
                    <span>{{ hookHealth.metrics.relevance }}%</span>
                  </div>
                  <UProgress :value="hookHealth.metrics.relevance" size="xs" color="primary" />
                </div>
                <div class="space-y-2">
                  <div class="flex justify-between text-xs font-mono">
                    <span class="text-muted-foreground">{{
                      t('script.metrics.estRetention')
                      }}</span>
                    <span>{{ hookHealth.metrics.retention }}%</span>
                  </div>
                  <UProgress :value="hookHealth.metrics.retention" size="xs" color="primary" />
                </div>
              </div>

              <div class="mt-6 space-y-4">
                <div>
                  <h4 class="text-xs font-mono text-muted-foreground uppercase mb-2">{{
                    t('script.analysis') }}</h4>
                  <p class="text-sm border-l-2 border-border pl-4">{{ hookHealth.feedback }}</p>
                </div>

                <div>
                  <h4 class="text-xs font-mono text-muted-foreground uppercase mb-2">{{
                    t('script.adjustments') }}</h4>
                  <ul class="space-y-1">
                    <li v-for="(adj, i) in hookHealth.adjustments" :key="i"
                      class="text-xs text-muted-foreground flex items-center gap-2">
                      <UIcon name="i-lucide-circle-check" class="text-neutral-400" /> {{ adj }}
                    </li>
                  </ul>
                </div>

                <div class="space-y-2">
                  <h4 class="text-xs font-mono text-muted-foreground uppercase">{{
                    t('script.improvedScript') }}</h4>
                  <div
                    class="bg-muted p-4 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed border border-border">
                    {{ hookHealth.improvedScript }}
                  </div>
                  <UButton block color="neutral" variant="soft"
                    @click="acceptImprovedScript(hookHealth!.improvedScript)">
                    {{ t('script.acceptScript') }}
                  </UButton>
                </div>

                <div v-if="hookHealth.alternativeVersions?.length" class="space-y-4 pt-4 border-t border-border mt-6">
                  <h4 class="text-xs font-mono text-muted-foreground uppercase">{{
                    t('script.alternativeHooks') }}</h4>
                  <div v-for="(alt, idx) in hookHealth.alternativeVersions" :key="idx"
                    class="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
                    <div class="flex justify-between items-start">
                      <div>
                        <h5 class="font-bold text-sm">{{ alt.hookName }}</h5>
                        <p class="text-[10px] text-muted-foreground mt-0.5">{{ alt.reasoning }}
                        </p>
                      </div>
                      <div class="text-right">
                        <div class="text-[10px] font-mono text-muted-foreground uppercase">{{
                          t('script.metrics.estRetention') }}</div>
                        <div class="font-mono font-bold text-sm">{{ alt.predictedRetention }}%
                        </div>
                      </div>
                    </div>
                    <div
                      class="bg-background border border-border rounded-lg p-3 text-[10px] font-mono whitespace-pre-wrap leading-relaxed">
                      {{ alt.script }}
                    </div>
                    <UButton block size="xs" color="neutral" variant="outline"
                      @click="acceptImprovedScript(alt.script)">
                      {{ t('script.useThisVersion') }}
                    </UButton>
                  </div>
                </div>
              </div>
            </UCard>
          </div>
        </section>
      </div>

      <div class="space-y-8">
        <section class="space-y-6">
          <div class="flex justify-between items-center">
            <h2 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span
                class="bg-primary text-primary-foreground w-6 h-6 flex items-center justify-center rounded text-xs">2</span>
              {{ t('record.title') }}
            </h2>
            <span class="text-xs font-mono text-muted-foreground">{{ t('record.duration2h') }}</span>
          </div>

          <UCard>
            <div class="flex flex-col items-center justify-center space-y-6 py-8">
              <UIcon name="i-lucide-video" class="text-5xl text-muted-foreground" />
              <div class="text-center">
                <h3 class="font-bold text-lg">{{ t('record.readyTitle') }}</h3>
                <p class="text-sm text-muted-foreground mt-1">{{
                  t('record.readySubtitle') }}
                </p>
              </div>

              <div class="w-full max-w-xs space-y-4">
                <div class="grid grid-cols-3 gap-2">
                  <UButton v-for="ratio in (['16:9', '9:16', '1:1'] as const)" :key="ratio" color="neutral"
                    :variant="aspectRatio === ratio ? 'solid' : 'outline'" size="xs" class="justify-center"
                    @click="aspectRatio = ratio">
                    {{ ratio }}
                  </UButton>
                </div>
                <UButton block size="lg" icon="i-lucide-maximize" @click="enterFocusMode">
                  {{ t('record.enterFocusMode') }}
                </UButton>
              </div>

              <div
                v-if="videoPreviewUrl"
                class="w-full space-y-3 pt-6 border-t border-border">
                <div class="flex justify-between items-center">
                  <span class="text-xs font-mono text-muted-foreground uppercase">{{
                    t('record.latestRecording') }}</span>
                  <div class="flex gap-2">
                    <UButton color="primary" variant="link" size="xs" icon="i-lucide-download" @click="() => downloadVideo()">
                      {{ t('record.download') }}
                    </UButton>
                    <UButton color="neutral" variant="link" size="xs" @click="clearVideo">
                      {{ t('record.clear') }}
                    </UButton>
                  </div>
                </div>
                <div
                  :class="['mx-auto overflow-hidden rounded-xl border-4 border-muted shadow-2xl bg-black', aspectRatio === '9:16' ? 'w-1/2 aspect-9/16' : aspectRatio === '1:1' ? 'w-2/3 aspect-square' : 'w-full aspect-video']">
                  <video :src="videoPreviewUrl" controls class="w-full h-full object-contain" />
                </div>

              </div>
            </div>
          </UCard>
        </section>
      </div>

      <section class="space-y-6">
        <div class="flex justify-between items-center">
          <h2 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <span
              class="bg-primary text-primary-foreground w-6 h-6 flex items-center justify-center rounded text-xs">3</span>
            {{ t('editChecklist.title') }}
          </h2>
          <span class="text-xs font-mono text-muted-foreground">{{ t('editChecklist.duration1h') }}</span>
        </div>
        <UCard>
          <div class="space-y-3">
            <UCheckbox v-model="editChecklist.hookEngaging" :label="t('editChecklist.hook')" />
            <UCheckbox v-model="editChecklist.valueDelivered" :label="t('editChecklist.value')" />
            <UCheckbox v-model="editChecklist.clearCta" :label="t('editChecklist.cta')" />
          </div>
        </UCard>
      </section>

      <section class="space-y-6">
        <div class="flex justify-between items-center">
          <h2 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <span
              class="bg-primary text-primary-foreground w-6 h-6 flex items-center justify-center rounded text-xs">4</span>
            {{ t('upload.title') }}
          </h2>
          <span class="text-xs font-mono text-muted-foreground">{{ t('upload.durationNextSteps') }}</span>
        </div>
        <UCard>
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="block text-xs font-mono text-muted-foreground uppercase">{{
                t('upload.videoUrl') }}</label>
              <UInput v-model="videoUrl" :placeholder="t('upload.placeholder')" block />
            </div>
            <UButton :loading="isPublishing" block size="lg" color="primary" icon="i-lucide-cloud-upload"
              @click="onMarkAsPublished">
              {{ t('upload.markPublished') }}
            </UButton>
          </div>
        </UCard>
      </section>
    </div>
  </div>

  <UModal v-model:open="isFocusMode" fullscreen>
    <template #content>
      <div class=" w-full h-full inset-0 z-50 bg-background flex flex-col items-center justify-center overflow-hidden">
        <div
          class="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-50 bg-linear-to-b from-background/90 to-transparent">
          <div class="flex items-center gap-4">
            <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="lg" @click="exitFocusMode" />
            <span class="text-sm font-bold uppercase tracking-widest text-muted-foreground">{{
              t('record.focusMode') }}</span>
          </div>
          <div v-if="isRecording"
            class="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-600">
            <div class="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span class="text-lg font-mono font-bold tabular-nums">{{ formatTime(timer) }}</span>
          </div>
        </div>

        <div class="flex-1 relative w-full h-full flex items-center justify-center p-4 md:p-12 overflow-hidden">
          <div
            :class="['relative bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border border-border transition-all duration-700', aspectRatio === '9:16' ? 'h-full aspect-9/16' : aspectRatio === '1:1' ? 'h-full aspect-square' : 'w-full max-w-6xl aspect-video']">
            <video ref="videoRef" autoplay muted playsinline
              class="absolute inset-0 w-full h-full object-cover opacity-30" />

            <div v-if="words.length > 0"
              class="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 text-center bg-black/40">
              <transition-group name="word" tag="div"
                :class="['font-sans font-extrabold leading-tight tracking-tight flex flex-wrap justify-center gap-x-4 gap-y-2 select-none', aspectRatio === '9:16' ? 'text-4xl' : 'text-5xl md:text-7xl']">
                <span v-for="(word, idx) in currentLine" :key="idx" :class="[
                  'transition-all duration-300',
                  Number(idx) === Number(currentWordIndex) % WORDS_PER_LINE ? 'text-primary scale-110 drop-shadow-[0_0_20px_rgba(var(--color-primary-500),0.5)]' : Number(idx) < Number(currentWordIndex) % WORDS_PER_LINE ? 'text-white/20' : 'text-white'
                ]">
                  {{ word }}
                </span>
              </transition-group>
              <div v-if="nextLine.length" class="absolute bottom-12 inset-x-0 flex justify-center opacity-40">
                <p
                  :class="['text-white/80 font-medium tracking-wide bg-white/5 px-6 py-2 rounded-full backdrop-blur-sm truncate max-w-[80%]', aspectRatio === '9:16' ? 'text-lg' : 'text-2xl']">
                  Next: {{ nextLine.join(' ') }}
                </p>
              </div>
            </div>
            <div v-else class="absolute inset-0 z-10 flex items-center justify-center text-white/50 font-mono text-sm">
              {{ t('record.noScript') }}
            </div>
          </div>
        </div>

        <div
          class="absolute bottom-0 inset-x-0 p-8 flex flex-col items-center gap-6 z-50 bg-linear-to-t from-background via-background/80 to-transparent">
          <div v-if="isCountingDown" class="text-9xl font-black text-white animate-pulse">
            {{ countdown }}
          </div>
          <div
            class="flex flex-col md:flex-row items-center gap-6 w-full max-w-2xl px-8 py-6 rounded-3xl bg-background/50 backdrop-blur-xl border border-border shadow-lg">
            <div class="flex-1 w-full space-y-2">
              <div class="flex justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                <span>{{ t('record.speed') }}</span>
                <span>{{ speedMultiplier.toFixed(1) }}x</span>
              </div>
              <USlider v-model="speedMultiplier" :min="0.5" :max="2.5" :step="0.1" color="primary" />
            </div>

            <div class="flex gap-2">
              <UButton icon="i-lucide-chevron-up" color="neutral" variant="soft" size="lg" square
                :disabled="Number(currentWordIndex) < WORDS_PER_LINE"
                @click="currentWordIndex = Math.max(0, currentWordIndex - WORDS_PER_LINE)" />
              <UButton icon="i-lucide-chevron-down" color="neutral" variant="soft" size="lg" square
                :disabled="currentLineIndex >= lines.length - 1"
                @click="currentWordIndex = Math.min(words.length - 1, currentWordIndex + WORDS_PER_LINE)" />
              <UButton :icon="isAutoScroll ? 'i-lucide-pause' : 'i-lucide-play'"
                :color="isAutoScroll ? 'primary' : 'neutral'" variant="soft" size="lg" square :disabled="!isRecording"
                @click="isAutoScroll = !isAutoScroll" />
            </div>
          </div>

          <div class="relative group">
            <div v-if="!isVideoRecording"
              class="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:bg-primary/30 transition-all scale-110" />
            <UButton v-if="!isVideoRecording" size="xl" color="primary" variant="solid"
              class="rounded-full px-12 py-5 text-lg font-black uppercase tracking-[0.2em] shadow-2xl relative transition-transform active:scale-95"
              @click="startRecordingWithCountdown">
              <UIcon name="i-lucide-video" class="mr-3" />
              {{ t('record.startRecording')}}
            </UButton>
            <UButton v-else size="xl" color="error" variant="solid"
              class="rounded-full px-12 py-5 text-lg font-black uppercase tracking-[0.2em] shadow-2xl relative transition-transform active:scale-95 animate-pulse"
              @click="stopRecording">
              <UIcon name="i-lucide-square" class="mr-3" />
              {{ t('record.stopRecording')}}
            </UButton>
          </div>
        </div>
      </div>

      <canvas ref="canvasRef" class="fixed top-0 left-0 w-px h-px opacity-0 pointer-events-none" />
    </template>
  </UModal>
</template>

<style scoped>
.word-enter-active,
.word-leave-active {
  transition: all 0.3s ease;
}

.word-enter-from,
.word-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.9);
}
</style>
