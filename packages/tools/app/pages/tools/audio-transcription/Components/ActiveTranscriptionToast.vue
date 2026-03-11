<script setup lang="ts">
/**
 *
 * Component Description: Floating panel displaying the active transcription progress and latest chunks
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { ref, watch } from 'vue'

const props = defineProps<{
	activeFile: TranscriptionFile
	currentModel: string
	audioSrc?: string
	isMinimized?: boolean
}>()

const emit = defineEmits<{
	(e: 'clear' | 'minimize' | 'maximize'): void
	(e: 'abort', id: string): void
	(e: 'download', id: string, format: 'text' | 'json' | 'timestamps'): void
}>()

const audioElement = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

function formatTime(seconds: number) {
	if (!seconds || isNaN(seconds)) return '0:00'
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins}:${secs.toString().padStart(2, '0')}`
}

const currentText = computed(() => {
	if (!props.activeFile?.result?.chunks) return null
	return props.activeFile.result.chunks.find(chunk =>
		currentTime.value >= chunk.start && currentTime.value <= chunk.end
	)?.text
})

function togglePlayback() {
	if (!audioElement.value) return
	if (isPlaying.value) {
		audioElement.value.pause()
	} else {
		audioElement.value.play()
	}
}

function handleTimeUpdate(e: Event) {
	const target = e.target as HTMLAudioElement
	currentTime.value = target.currentTime
}

function handleLoadedMetadata(e: Event) {
	const target = e.target as HTMLAudioElement
	duration.value = target.duration || 1
}

function seekTo(event: MouseEvent) {
	if (!audioElement.value) return
	const target = event.currentTarget as HTMLElement
	const rect = target.getBoundingClientRect()
	const pos = (event.clientX - rect.left) / rect.width
	let newTime = 0
	if (props.activeFile.status === 'done') {
		newTime = pos * duration.value
		audioElement.value.currentTime = newTime
	}
	currentTime.value = newTime
}

watch(isPlaying, (playing) => {
	if (playing && audioElement.value) {
		audioElement.value.play()
	}
})
</script>

<template>
	<div v-if="activeFile" class="z-100">
		<!-- Inactive / Minimized Top Notch -->
		<div
			v-if="isMinimized"
			v-motion
			class="fixed top-4 left-1/2 -translate-x-1/2 z-100 pointer-events-auto"
			:initial="{ y: -50, opacity: 0 }"
			:enter="{ y: 0, opacity: 1 }"
		>
			<div
				class="bg-gray-950/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-800 rounded-full shadow-2xl px-5 py-2 flex items-center gap-4 cursor-pointer hover:bg-gray-900 dark:hover:bg-gray-800 transition-colors"
				@click="emit('maximize')"
			>
				<span class="text-[10px] font-bold text-primary-400 tracking-widest uppercase">Processing</span>
				<span class="text-sm font-medium text-gray-300 max-w-[150px] truncate" :title="activeFile.name">{{ activeFile.name }}</span>
				<span class="text-[10px] font-mono font-bold text-gray-500">{{ isNaN(activeFile.progress) ? 0 : activeFile.progress }}%</span>
				<div class="flex gap-0.5 ml-2">
					<span class="w-1 bg-primary-500 rounded-full h-3 animate-[vuemeter_0.6s_infinite]"/>
					<span class="w-1 bg-primary-500 rounded-full h-2 animate-[vuemeter_0.8s_infinite] delay-75"/>
					<span class="w-1 bg-primary-500 rounded-full h-4 animate-[vuemeter_0.5s_infinite] delay-150"/>
				</div>
				<UButton icon="i-lucide-x" color="red" variant="ghost" size="xs" class="ml-2" @click.stop="emit('abort', activeFile.id)" />
			</div>
		</div>

		<!-- Active Bottom Player -->
		<div v-else class="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 pointer-events-none z-100">
			<div
				v-motion
				:initial="{ y: 50, opacity: 0 }"
				:enter="{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 250, damping: 25 } }"
				class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-6 pointer-events-auto flex flex-col gap-6"
			>
				<div class="flex justify-between items-center">
					<div class="flex items-center gap-3">
						<span :class="['h-3 w-3 rounded-full', activeFile.status === 'done' ? 'bg-gray-500' : 'bg-primary-500 animate-pulse']"/>
						<span class="text-sm font-bold tracking-tight text-gray-900 dark:text-gray-100">{{ activeFile.status === 'done' ? 'Playing' : 'Transcribing' }}: {{ activeFile.name }}</span>
						<UBadge color="gray" variant="soft" class="ml-2 uppercase tracking-widest text-[10px] font-bold">Whisper {{ currentModel }}</UBadge>
					</div>
					<div class="flex gap-2">
						<UButton icon="i-lucide-minus" color="gray" variant="ghost" @click="emit('minimize')" />
						<UButton icon="i-lucide-x" color="red" variant="ghost" @click="activeFile.status === 'transcribing' ? emit('abort', activeFile.id) : emit('clear')" />
					</div>
				</div>

				<!-- Big Central Caption for Synchronization -->
				<div class="h-12 flex flex-col items-center justify-center text-center px-8">
					<transition name="fade" mode="out-in">
						<p v-if="currentText" :key="currentText" class="text-lg font-bold text-gray-900 dark:text-gray-100 tracking-tight line-clamp-2">
							"{{ currentText }}"
						</p>
						<p v-else class="text-sm text-gray-400 font-medium">
							{{ activeFile.status === 'transcribing' ? 'Transcribing audio in real-time...' : 'Select a timestamp or press play to begin' }}
						</p>
					</transition>
				</div>

				<div class="relative w-full h-24 bg-gray-50 dark:bg-gray-950 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 cursor-pointer" @click="seekTo">
					<div class="absolute inset-0 bg-linear-to-r from-white dark:from-gray-900 via-transparent to-white dark:to-gray-900 pointer-events-none z-10"/>
					<!-- Playhead -->
					<div class="absolute top-0 bottom-0 w-[2px] bg-primary-500 z-20 transition-all duration-75 ease-linear pointer-events-none shadow-[0_0_10px_rgba(var(--color-primary-500),0.8)]" :style="{ left: activeFile.status === 'transcribing' ? `${activeFile.progress}%` : `${(currentTime / duration) * 100 || 0}%` }"/>
				</div>

				<div v-if="activeFile.result" class="bg-gray-50/50 dark:bg-gray-950/40 rounded-xl p-6 border border-gray-200/60 dark:border-gray-800/60 max-h-40 overflow-y-auto">
					<div v-if="activeFile.result.chunks?.length" class="flex flex-col gap-4">
						<div v-for="(chunk, idx) in (activeFile.status === 'done' ? activeFile.result.chunks : activeFile.result.chunks.slice(-3))" :key="idx" class="flex gap-6 fade-in items-start group">
							<span class="text-xs font-bold font-mono tracking-widest w-12 shrink-0 mt-0.5 text-right transition-colors" :class="currentTime >= chunk.start && currentTime <= chunk.end ? 'text-primary-500' : 'text-gray-500 group-hover:text-gray-400'">
								{{ formatTime(chunk.start) }}
							</span>
							<div class="flex-1 pl-4 transition-colors" :class="currentTime >= chunk.start && currentTime <= chunk.end ? 'border-l-2 border-primary-500' : 'border-l-2 border-transparent'">
								<p class="text-sm leading-relaxed transition-colors" :class="currentTime >= chunk.start && currentTime <= chunk.end ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-500'">{{ chunk.text }}</p>
							</div>
						</div>
					</div>
					<div v-else-if="activeFile.status === 'transcribing'" class="flex flex-col items-center justify-center py-4 text-center">
						<UIcon name="i-lucide-activity" class="text-xl animate-pulse mb-2 text-primary-500" />
						<p class="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500">Wait... AI is listening</p>
					</div>
				</div>

				<div class="flex items-center justify-between mt-2">
					<div class="flex items-center gap-6">
						<UButton icon="i-lucide-rewind" color="gray" variant="ghost" class="text-xl" />
						<UButton
							:icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
							color="primary"
							size="xl"
							class="rounded-full shadow-lg shadow-primary-500/20 active:scale-95 transition-transform"
							@click="togglePlayback"
						/>
						<UButton icon="i-lucide-fast-forward" color="gray" variant="ghost" class="text-xl" />
					</div>

					<div class="flex items-center gap-6">
						<div class="flex items-center gap-3 text-gray-500 dark:text-gray-400">
							<UIcon name="i-lucide-volume-2" class="text-lg" />
							<div class="w-16 h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden relative">
								<div class="absolute left-0 top-0 h-full w-2/3 bg-gray-500 dark:bg-gray-400"/>
							</div>
						</div>
						<UButton
							v-if="activeFile.status === 'done'"
							color="neutral"
							variant="solid"
							size="md"
							icon="i-lucide-download"
							@click="emit('download', activeFile.id, 'timestamps')"
						>
							Export Transcript
						</UButton>
					</div>
				</div>
			</div>
		</div>

		<audio
			v-if="audioSrc"
			ref="audioElement"
			:src="audioSrc"
			class="hidden"
			@timeupdate="handleTimeUpdate"
			@loadedmetadata="handleLoadedMetadata"
			@ended="isPlaying = false"
			@play="isPlaying = true"
			@pause="isPlaying = false"
		/>
	</div>
</template>

<style scoped>
.fade-in {
	animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
	from { opacity: 0; transform: translateY(5px); }
	to { opacity: 1; transform: translateY(0); }
}
</style>
