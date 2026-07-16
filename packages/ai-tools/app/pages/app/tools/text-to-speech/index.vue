<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 * Supertonic 3 — Text to Speech Tool
 *
 * Lightning-fast, on-device TTS with 10 voices, 31 languages.
 * Powered by ONNX Runtime Web and the Supertonic 3 model.
 *
 * Features:
 *   - Worker-mode default (non-blocking UI)
 *   - Cancel button during active synthesis
 *   - IndexedDB history of all past generations
 *   - Play/download/delete historical entries
 *
 * @author MagicSync Team
 * @version 0.3.0
 */
import { useTextToSpeech } from './composables/useTextToSpeech'
import { useTtsHistory, type GenerationRecord } from './composables/useTtsHistory'

const { t } = useI18n()
const toast = useToast()

const {
  status,
  isReady,
  isSynthesizing,
  isLoadingModel,
  hasResult,
  canDownload,
  progressPercent,
  loadingProgress,
  loadingText,
  synthesisProgress,
  resultDuration,
  detectedLanguage,
  errorMessage,
  currentVoiceId,
  currentLanguage,
  currentSpeed,
  currentQuality,
  AVAILABLE_VOICES,
  availableVoices,
  AVAILABLE_LANGUAGES,
  synthesize,
  cancel,
  playAudio,
  stopPlayback,
  downloadAudio,
  resetResult,
  setVoice,
  setLanguage,
  setSpeed,
  setQuality,
  loadModel,
  cleanup,
  useWorker,
  toggleWorker,
} = useTextToSpeech()

const history = useTtsHistory()

// ── Lifecycle ─────────────────────────────────────────────────────
onMounted(async () => {
  loadModel()
  await history.load()
})
onBeforeUnmount(() => cleanup())

// ── Form State ────────────────────────────────────────────────────
const inputText = ref('')
const maxChars = 5000
const isPlaying = ref(false)
const playingId = ref<string | null>(null)

// ── Computed ──────────────────────────────────────────────────────
const charCount = computed(() => inputText.value.length)

// Regenerate-friendly: allow click when not actively synthesizing/loading,
// regardless of status (so user can re-run from done/error without resetting).
const canGenerate = computed(() =>
  inputText.value.trim().length > 0 &&
  !isSynthesizing.value &&
  !isLoadingModel.value,
)

const selectedVoice = computed(() =>
  availableVoices.value.find(v => v.id === currentVoiceId.value),
)
const selectedLanguage = computed(() =>
  AVAILABLE_LANGUAGES.find(l => l.code === currentLanguage.value),
)
const formattedDuration = computed(() => resultDuration.value.toFixed(1))
const formattedSpeed = computed(() => currentSpeed.value.toFixed(2) + 'x')

const voiceItems = computed(() =>
  availableVoices.value.map(v => ({
    label: v.name, value: v.id,
    description: v.gender === 'male' ? 'Male' : 'Female',
  })),
)
const languageItems = computed(() =>
  AVAILABLE_LANGUAGES.map(l => ({ label: l.name, value: l.code })),
)

watch(currentVoiceId, (id) => setVoice(id))

// ── Handlers ──────────────────────────────────────────────────────
async function handleGenerate() {
  if (!canGenerate.value) return
  stopPlayback()
  isPlaying.value = false
  playingId.value = null

  try {
    const result = await synthesize(inputText.value)
    if (result) {
      // Persist to IndexedDB history. Failure here is non-fatal — the audio
      // is still in the current result for this session.
      try {
        const snippet = result.text.length > 60 ? `${result.text.slice(0, 60)}…` : result.text
        await history.add({
          text: result.text,
          textSnippet: snippet,
          voiceId: result.voiceId,
          voiceName: selectedVoice.value?.name || result.voiceId,
          language: result.language,
          languageName: selectedLanguage.value?.name || result.language,
          duration: result.duration,
          sampleRate: result.sampleRate,
          // Store both Float32Array (for instant play) and WAV (for download).
          // IndexedDB structured-clones typed arrays natively.
          audio: result.audio,
          wavBuffer: result.wavBuffer,
        })
      }
      catch {
        // eslint-disable-next-line no-console
        console.warn('[TTS] Failed to save to history (IndexedDB)')
      }
      toast.add({ title: t('notifications.synthesis_complete'), color: 'success' })
    }
    else {
      // null = user cancelled
      toast.add({ title: t('notifications.synthesis_cancelled'), color: 'info' })
    }
  }
  catch (err: any) {
    toast.add({ title: t('notifications.synthesis_error'), description: err?.message, color: 'error' })
  }
}

function handleCancel() {
  // NOT adding a toast here — synthesize()'s Promise resolves with `null` on
  // cancel and handleGenerate's else branch shows the single info toast.
  // Adding one here caused two toasts stacked on every cancel.
  cancel()
}

async function handlePlay() {
  if (isPlaying.value) {
    stopPlayback()
    isPlaying.value = false
    playingId.value = null
  }
  else {
    await playAudio()
    isPlaying.value = true
    playingId.value = 'current'
  }
}

async function handlePlayHistory(gen: GenerationRecord) {
  // Stop any current playback first
  stopPlayback()
  await playAudio(gen.audio, gen.sampleRate)
  isPlaying.value = true
  playingId.value = gen.id
}

function handleDownload() {
  const name = `supertonic-${currentVoiceId.value}-${Date.now()}.wav`
  downloadAudio(name)
  toast.add({ title: t('notifications.download_started'), color: 'info' })
}

function handleDownloadHistory(gen: GenerationRecord) {
  const safeName = `supertonic-${gen.voiceId}-${gen.id.slice(0, 8)}.wav`
  downloadAudio(safeName, gen.wavBuffer)
  toast.add({ title: t('notifications.download_started'), color: 'info' })
}

async function handleDeleteHistory(gen: GenerationRecord) {
  if (!confirm(t('history.actions.delete_confirm'))) return
  await history.remove(gen.id)
  if (playingId.value === gen.id) {
    stopPlayback()
    isPlaying.value = false
    playingId.value = null
  }
  toast.add({ title: t('history.removed_toast'), color: 'info' })
}

async function handleClearHistory() {
  if (!confirm(t('history.actions.clearAll_confirm'))) return
  await history.clear()
  stopPlayback()
  isPlaying.value = false
  playingId.value = null
  toast.add({ title: t('history.cleared_toast'), color: 'info' })
}

function handleClear() {
  inputText.value = ''
  stopPlayback()
  isPlaying.value = false
  playingId.value = null
}

function handleNewSynthesis() {
  stopPlayback()
  isPlaying.value = false
  playingId.value = null
  resetResult()
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    handleGenerate()
  }
  if (e.key === 'Escape' && isSynthesizing.value) {
    e.preventDefault()
    handleCancel()
  }
}

// ── Helpers ───────────────────────────────────────────────────────
function getVoiceIcon(voiceId: string): string {
  const v = AVAILABLE_VOICES.find(x => x.id === voiceId)
  return v?.gender === 'female' ? 'i-lucide-venus' : 'i-lucide-mars'
}

function formatRelativeTime(ts: number): string {
  const diff = Math.max(0, now.value - ts)
  const sec = Math.floor(diff / 1000)
  if (sec < 5) return t('history.just_now')
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  return `${day}d`
}

// Reactive "now" so relative-time labels re-render every 30s without
// reallocating the whole history array on each tick.
const now = ref(Date.now())
let relativeTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  relativeTimer = setInterval(() => { now.value = Date.now() }, 30000)
})
onBeforeUnmount(() => { if (relativeTimer) clearInterval(relativeTimer) })

// ── Waveform bars (pre-computed) ──────────────────────────────────
const barHeights = Array.from({ length: 40 }, () => 15 + Math.random() * 55)

// ── SEO ───────────────────────────────────────────────────────────
useHead({
  title: t('title'),
  meta: [{ name: 'description', content: t('description') }],
})
defineOgImage('BlogOgImage', {
  title: t('title'),
  description: t('description'),
  headline: 'Free Tools',
  imageUrl: 'https://raw.githubusercontent.com/leamsigc/MagicSync/refs/heads/main/images/HomePage.png',
})
</script>

<template>
  <div class="min-h-screen font-sans bg-default text-highlighted antialiased">
    <main class="flex-1 flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      <!-- Header -->
      <header class="pt-8 pb-2">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <UIcon name="i-lucide-zap" class="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 class="text-2xl font-bold tracking-tight">{{ t('header.title') }}</h1>
            <p class="text-sm text-dimmed">{{ t('header.subtitle') }}</p>
          </div>
        </div>
      </header>

      <div class="grid grid-cols-12 gap-6">
        <!-- ── LEFT COLUMN ─────────────────────────────────────────────── -->
        <div class="col-span-12 lg:col-span-7 flex flex-col gap-5">
          <!-- Text Input Card -->
          <UCard :ui="{ body: 'p-5', root: 'w-full' }">
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="font-semibold text-sm text-highlighted">{{ t('input.label') }}</h3>
                <span
                  class="text-xs font-mono"
                  :class="charCount > maxChars * 0.9 ? 'text-red-400' : 'text-dimmed'"
                >
                  {{ t('input.char_count', { count: charCount, max: maxChars }) }}
                </span>
              </div>
            </template>

            <UTextarea
              v-model="inputText"
              :placeholder="String(t('input.placeholder'))"
              :maxlength="maxChars"
              :rows="8"
              autoresize
              size="lg"
              class="w-full font-mono text-sm"
              @keydown="handleKeydown"
            />

            <div class="flex items-center gap-2 mt-3">
              <UButton
                v-if="inputText"
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                @click="handleClear"
              >
                {{ t('input.clear') }}
              </UButton>
              <span class="text-[10px] text-dimmed ml-auto font-mono">
                {{ '\u2318' }}+Enter &middot; Esc to cancel
              </span>
            </div>
          </UCard>

          <!-- Configuration Card -->
          <UCard :ui="{ body: 'p-5', root: 'w-full' }">
            <template #header>
              <h3 class="font-semibold text-sm text-highlighted">Configuration</h3>
            </template>

            <div class="flex flex-col gap-5">
              <!-- Voice + Language row -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Voice Selector -->
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-medium text-dimmed">{{ t('voice.label') }}</label>
                  <USelectMenu
                    v-model="currentVoiceId"
                    :items="voiceItems"
                    value-key="value"
                    label-key="label"
                    :searchable="false"
                    class="w-full"
                  >
                    <UButton variant="outline" size="sm" block class="justify-between">
                      <div class="flex items-center gap-2 truncate">
                        <UIcon
                          :name="selectedVoice?.gender === 'female' ? 'i-lucide-venus' : 'i-lucide-mars'"
                          class="w-3 h-3 shrink-0"
                        />
                        <span class="text-xs">{{ selectedVoice?.name }}</span>
                        <UBadge variant="subtle" size="sm" class="text-[9px] px-1 py-0">
                          {{ selectedVoice?.gender }}
                        </UBadge>
                      </div>
                      <UIcon name="i-lucide-chevrons-up-down" class="w-3.5 h-3.5 text-dimmed shrink-0" />
                    </UButton>
                  </USelectMenu>
                  <p class="text-[10px] text-dimmed font-mono">{{ t('voice.description') }}</p>
                </div>

                <!-- Language Selector -->
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-medium text-dimmed">{{ t('language.label') }}</label>
                  <USelectMenu
                    v-model="currentLanguage"
                    :items="languageItems"
                    value-key="value"
                    label-key="label"
                    :searchable="false"
                    class="w-full"
                  >
                    <UButton variant="outline" size="sm" block class="justify-between">
                      <div class="flex items-center gap-2 truncate">
                        <UIcon name="i-lucide-globe" class="w-3 h-3 shrink-0 text-dimmed" />
                        <span class="text-xs">{{ selectedLanguage?.name }}</span>
                        <UBadge variant="subtle" size="sm" class="text-[9px] px-1 py-0 font-mono uppercase">
                          {{ currentLanguage }}
                        </UBadge>
                      </div>
                      <UIcon name="i-lucide-chevrons-up-down" class="w-3.5 h-3.5 text-dimmed shrink-0" />
                    </UButton>
                  </USelectMenu>
                  <p class="text-[10px] text-dimmed font-mono">{{ t('language.description') }}</p>
                </div>
              </div>

              <!-- Speed Slider -->
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-medium text-dimmed">{{ t('speed.label') }}</label>
                  <span class="text-xs font-mono text-primary font-semibold">{{ formattedSpeed }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-[10px] text-dimmed font-mono">0.8x</span>
                  <input
                    type="range"
                    :min="0.8"
                    :max="1.3"
                    :step="0.05"
                    :value="currentSpeed"
                    class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    @input="(e: Event) => setSpeed(parseFloat((e.target as HTMLInputElement).value))"
                  >
                  <span class="text-[10px] text-dimmed font-mono">1.3x</span>
                </div>
              </div>

              <!-- Quality Slider -->
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-medium text-dimmed">{{ t('quality.label') }}</label>
                  <span class="text-xs font-mono text-primary font-semibold">{{ currentQuality }} steps</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-[10px] text-dimmed font-mono">Fast</span>
                  <input
                    type="range"
                    :min="2"
                    :max="16"
                    :step="1"
                    :value="currentQuality"
                    class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    @input="(e: Event) => setQuality(parseInt((e.target as HTMLInputElement).value))"
                  >
                  <span class="text-[10px] text-dimmed font-mono">Best</span>
                </div>
              </div>

              <!-- Execution Mode Toggle -->
              <div class="flex items-center justify-between pt-2 border-t border-default">
                <div class="flex flex-col gap-0.5">
                  <label class="text-xs font-medium text-dimmed">Execution Mode</label>
                  <p class="text-[10px] text-dimmed font-mono">
                    {{ useWorker ? 'Web Worker — non-blocking UI (default)' : 'Main Thread — simpler' }}
                  </p>
                </div>
                <USwitch
                  :model-value="useWorker"
                  :disabled="isSynthesizing || isLoadingModel"
                  @update:model-value="()=>{toggleWorker()}"
                />
              </div>
            </div>
          </UCard>

          <!-- Generate / Cancel row -->
          <div class="flex items-center gap-3">
            <UButton
              v-if="isSynthesizing"
              color="error"
              size="lg"
              icon="i-lucide-square"
              block
              @click="handleCancel"
            >
              {{ t('actions.cancel') }}
            </UButton>
            <UButton
              v-else
              color="primary"
              size="lg"
              :loading="isLoadingModel"
              :disabled="!canGenerate"
              icon="i-lucide-zap"
              block
              @click="handleGenerate"
            >
              <template v-if="isLoadingModel">
                {{ t('actions.loading_model') }}
              </template>
              <template v-else-if="hasResult">
                {{ t('actions.generate_again') }}
              </template>
              <template v-else>
                {{ t('actions.generate') }}
              </template>
            </UButton>
          </div>
        </div>

        <!-- ── RIGHT COLUMN ────────────────────────────────────────────── -->
        <div class="col-span-12 lg:col-span-5 flex flex-col gap-5">
          <!-- Audio Player Card -->
          <UCard :ui="{ body: 'p-5', root: 'w-full' }">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-audio-lines" class="w-4 h-4 text-primary" />
                <h3 class="font-semibold text-sm text-highlighted">{{ t('player.title') }}</h3>
                <div class="ml-auto flex items-center gap-2">
                  <UBadge v-if="detectedLanguage" color="info" variant="subtle" size="sm" class="text-[9px]">
                    {{ selectedLanguage?.name }}
                  </UBadge>
                  <UBadge v-if="hasResult" color="success" variant="subtle" size="sm">
                    {{ formattedDuration }}s
                  </UBadge>
                </div>
              </div>
            </template>

            <!-- No audio -->
            <div
              v-if="!hasResult && !isSynthesizing && !isLoadingModel"
              class="flex flex-col items-center justify-center py-12 text-center"
            >
              <div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <UIcon name="i-lucide-mic" class="w-8 h-8 text-dimmed" />
              </div>
              <p class="text-sm text-dimmed max-w-48">{{ t('player.no_audio') }}</p>
            </div>

            <!-- Loading -->
            <div v-else-if="isLoadingModel" class="flex flex-col items-center justify-center py-10 gap-4">
              <div class="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                <UIcon name="i-lucide-loader-circle" class="w-8 h-8 text-amber-400 animate-spin" />
              </div>
              <div class="text-center">
                <p class="text-sm font-medium text-highlighted">
                  {{ t('progress.loading_model', { text: loadingText || 'Initializing...' }) }}
                </p>
              </div>
              <UProgress :model-value="loadingProgress" size="sm" color="primary" class="w-full max-w-64" />
            </div>

            <!-- Synthesizing -->
            <div v-else-if="isSynthesizing" class="flex flex-col items-center justify-center py-10 gap-4">
              <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center relative">
                <UIcon name="i-lucide-sparkles" class="w-8 h-8 text-primary animate-pulse" />
              </div>
              <div class="text-center">
                <p class="text-sm font-medium text-highlighted">{{ t('progress.synthesizing') }}</p>
                <p class="text-[10px] text-dimmed mt-1 font-mono">
                  {{ currentQuality }} quality steps &bull; {{ currentSpeed.toFixed(2) }}x speed
                </p>
              </div>
              <UProgress
                :model-value="progressPercent"
                size="sm"
                color="primary"
                class="w-full max-w-64"
                animation="carousel"
              />
              <p class="text-[10px] text-dimmed font-mono">Click Cancel or press Esc to stop</p>
            </div>

            <!-- Done — player + waveform -->
            <div v-else-if="hasResult" class="flex flex-col gap-4">
              <div class="relative">
                <div class="bg-muted rounded-xl p-5 flex items-center justify-center h-28 overflow-hidden">
                  <div class="flex items-end gap-px h-16">
                    <div
                      v-for="(height, i) in barHeights"
                      :key="i"
                      class="w-1.5 rounded-full transition-all duration-300"
                      :class="isPlaying && playingId === 'current' ? 'bg-primary' : 'bg-primary/40'"
                      :style="{
                        height: `${height}%`,
                        animation: isPlaying && playingId === 'current'
                          ? `waveform-pulse ${0.8 + i * 0.03}s ease-in-out infinite`
                          : 'none',
                      }"
                    />
                  </div>
                </div>
              </div>
              <div class="flex items-center justify-center gap-3">
                <UButton
                  :color="isPlaying && playingId === 'current' ? 'primary' : 'neutral'"
                  :variant="isPlaying && playingId === 'current' ? 'solid' : 'outline'"
                  size="lg"
                  :icon="(isPlaying && playingId === 'current') ? 'i-lucide-pause' : 'i-lucide-play'"
                  @click="handlePlay"
                />
                <UButton
                  v-if="canDownload"
                  color="primary"
                  variant="soft"
                  size="md"
                  icon="i-lucide-download"
                  @click="handleDownload"
                >
                  {{ t('actions.download') }}
                </UButton>
              </div>
              <div class="flex items-center justify-center gap-3 text-xs text-dimmed font-mono">
                <span>{{ t('player.duration', { duration: formattedDuration }) }}</span>
                <span v-if="detectedLanguage">&bull;</span>
                <span v-if="detectedLanguage">Lang: {{ detectedLanguage }}</span>
              </div>
            </div>

            <!-- Error -->
            <div v-else-if="status === 'error'" class="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div class="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <UIcon name="i-lucide-triangle-alert" class="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p class="text-sm font-medium text-red-400">{{ t('progress.error', { error: errorMessage }) }}</p>
              </div>
            </div>
          </UCard>

          <!-- Status indicator -->
          <UCard v-if="status === 'synthesizing'" :ui="{ body: 'p-3', root: 'w-full' }">
            <div class="flex items-center gap-2 text-xs">
              <UIcon name="i-lucide-loader-circle" class="w-3.5 h-3.5 text-primary animate-spin" />
              <span class="text-dimmed font-mono">
                {{ t('progress.synthesizing') }} &middot; {{ synthesisProgress }}%
              </span>
            </div>
          </UCard>

          <!-- ── History Panel ─────────────────────────────────────── -->
          <UCard :ui="{ body: 'p-3', root: 'w-full' }">
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-history" class="w-4 h-4 text-primary" />
                  <h3 class="font-semibold text-sm text-highlighted">{{ t('history.title') }}</h3>
                  <UBadge
                    v-if="history.generations.value.length > 0"
                    variant="subtle"
                    size="sm"
                    class="text-[9px] font-mono"
                  >
                    {{ t('history.count', { count: history.generations.value.length }) }}
                  </UBadge>
                </div>
                <UButton
                  v-if="history.generations.value.length > 0"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-trash-2"
                  @click="handleClearHistory"
                >
                  {{ t('history.actions.clearAll') }}
                </UButton>
              </div>
            </template>

            <p v-if="history.generations.value.length > 0" class="text-[10px] text-dimmed font-mono mt-1 mb-2 italic">
              {{ t('history.subtitle') }}
            </p>

            <!-- Loading state -->
            <div v-if="history.loading.value" class="flex items-center justify-center py-6">
              <UIcon name="i-lucide-loader-circle" class="w-6 h-6 text-dimmed animate-spin" />
            </div>

            <!-- Empty state -->
            <div
              v-else-if="history.generations.value.length === 0"
              class="flex flex-col items-center justify-center py-8 text-center"
            >
              <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                <UIcon name="i-lucide-file-audio" class="w-5 h-5 text-dimmed" />
              </div>
              <p class="text-xs text-dimmed max-w-48">{{ t('history.empty') }}</p>
            </div>

            <!-- History list -->
            <div v-else class="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              <div
                v-for="gen in history.generations.value"
                :key="gen.id"
                class="group flex flex-col gap-1.5 p-2.5 rounded-xl border border-default bg-default/40 hover:border-primary/30 hover:bg-muted/30 transition-colors"
              >
                <div class="flex items-start gap-2">
                  <UIcon
                    name="i-lucide-message-square-quote"
                    class="w-3.5 h-3.5 mt-0.5 text-dimmed shrink-0"
                  />
                  <p class="text-xs font-mono leading-tight line-clamp-2 flex-1 text-highlighted">
                    {{ history.snippet(gen) }}
                  </p>
                </div>
                <div class="flex items-center gap-1.5 text-[10px] text-dimmed font-mono pl-5">
                  <UIcon :name="getVoiceIcon(gen.voiceId)" class="w-3 h-3 shrink-0" />
                  <span class="font-semibold text-highlighted">{{ gen.voiceName }}</span>
                  <span>&middot;</span>
                  <span class="uppercase">{{ gen.language }}</span>
                  <span>&middot;</span>
                  <span>{{ gen.duration.toFixed(1) }}s</span>
                  <span class="ml-auto tabular-nums">{{ formatRelativeTime(gen.timestamp) }}</span>
                </div>
                <div class="flex items-center gap-1 pl-5">
                  <UButton
                    color="primary"
                    variant="soft"
                    size="xs"
                    :icon="playingId === gen.id ? 'i-lucide-pause' : 'i-lucide-play'"
                    @click="playingId === gen.id ? (stopPlayback(), isPlaying = false, playingId = null) : handlePlayHistory(gen)"
                  >
                    {{ playingId === gen.id ? t('actions.pause') : t('history.actions.play') }}
                  </UButton>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-download"
                    @click="handleDownloadHistory(gen)"
                  >
                    {{ t('history.actions.download') }}
                  </UButton>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-trash-2"
                    class="ml-auto opacity-60 hover:opacity-100"
                    @click="handleDeleteHistory(gen)"
                  >
                    {{ t('history.actions.delete') }}
                  </UButton>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Features Cards -->
      <div class="mt-8">
        <h3 class="text-sm font-semibold text-highlighted mb-4">{{ t('features.title') }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <UCard :ui="{ body: 'p-4', root: 'w-full hover:border-primary/30 transition-colors' }">
            <div class="flex flex-col gap-2">
              <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <UIcon name="i-lucide-shield-check" class="w-4 h-4 text-amber-400" />
              </div>
              <h4 class="text-xs font-semibold text-highlighted">{{ t('features.private.title') }}</h4>
              <p class="text-[11px] text-dimmed leading-relaxed">{{ t('features.private.description') }}</p>
            </div>
          </UCard>

          <UCard :ui="{ body: 'p-4', root: 'w-full hover:border-primary/30 transition-colors' }">
            <div class="flex flex-col gap-2">
              <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <UIcon name="i-lucide-globe" class="w-4 h-4 text-amber-400" />
              </div>
              <h4 class="text-xs font-semibold text-highlighted">{{ t('features.multilingual.title') }}</h4>
              <p class="text-[11px] text-dimmed leading-relaxed">{{ t('features.multilingual.description') }}</p>
            </div>
          </UCard>

          <UCard :ui="{ body: 'p-4', root: 'w-full hover:border-primary/30 transition-colors' }">
            <div class="flex flex-col gap-2">
              <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <UIcon name="i-lucide-users" class="w-4 h-4 text-amber-400" />
              </div>
              <h4 class="text-xs font-semibold text-highlighted">{{ t('features.voices.title') }}</h4>
              <p class="text-[11px] text-dimmed leading-relaxed">{{ t('features.voices.description') }}</p>
            </div>
          </UCard>

          <UCard :ui="{ body: 'p-4', root: 'w-full hover:border-primary/30 transition-colors' }">
            <div class="flex flex-col gap-2">
              <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <UIcon name="i-lucide-history" class="w-4 h-4 text-amber-400" />
              </div>
              <h4 class="text-xs font-semibold text-highlighted">Generation History</h4>
              <p class="text-[11px] text-dimmed leading-relaxed">
                Every clip is saved locally in IndexedDB. Play, download, or delete any past generation.
              </p>
            </div>
          </UCard>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
@keyframes waveform-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
</style>
