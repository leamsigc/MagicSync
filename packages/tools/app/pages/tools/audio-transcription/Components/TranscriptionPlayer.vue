<script setup lang="ts">
/**
 *
 * Component Description: Audio player with current timestamp and simple waveform
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
	audioSrc: string
	currentTime: number
	duration: number
	isPlaying: boolean
	currentText?: string
}>()

const emit = defineEmits<{
	(e: 'update:currentTime' | 'timeupdate' | 'loadedmetadata', value: number): void
	(e: 'togglePlayback' | 'ended'): void
}>()

const audioElement = ref<HTMLAudioElement | null>(null)

function formatTime(seconds: number) {
	if (!seconds || isNaN(seconds)) return '0:00'
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins}:${secs.toString().padStart(2, '0')}`
}

function seekTo(event: MouseEvent) {
	if (!audioElement.value) return
	const target = event.currentTarget as HTMLElement
	const rect = target.getBoundingClientRect()
	const pos = (event.clientX - rect.left) / rect.width
	const newTime = pos * props.duration
	audioElement.value.currentTime = newTime
	emit('update:currentTime', newTime)
}

watch(() => props.isPlaying, (playing) => {
	if (playing) {
		audioElement.value?.play()
	} else {
		audioElement.value?.pause()
	}
})

function handleTimeUpdate(e: Event) {
	const target = e.target as HTMLAudioElement
	emit('timeupdate', target.currentTime)
}

function handleLoadedMetadata(e: Event) {
	const target = e.target as HTMLAudioElement
	emit('loadedmetadata', target.duration)
}
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
		<div class="flex items-center gap-4 mb-6">
			<UButton
				:icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
				color="primary"
				size="xl"
				class="rounded-full shadow-lg shadow-primary-500/20 active:scale-95 transition-transform"
				@click="emit('togglePlayback')"
			/>
			<div class="flex flex-col flex-1 overflow-hidden">
				<span class="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
					{{ formatTime(currentTime) }} <span class="text-gray-500 dark:text-gray-400 font-normal">/ {{ formatTime(duration) }}</span>
				</span>
				<div class="h-4 w-full">
					<transition name="fade" mode="out-in">
						<span v-if="currentText" :key="currentText" class="text-[10px] text-primary-600 dark:text-primary-400 font-bold uppercase tracking-widest truncate block">
							{{ currentText }}
						</span>
					</transition>
				</div>
			</div>
		</div>

		<div 
			class="relative h-24 flex items-center gap-[2px] overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800/50 cursor-pointer"
			@click="seekTo"
		>
			<div class="absolute inset-0 bg-linear-to-r from-white dark:from-gray-900 via-transparent to-white dark:to-gray-900 pointer-events-none z-10"/>
			<div class="flex-1 h-full flex items-center gap-[2px] px-4">
				<!-- Mock waveform visualization matching the design -->
				<div 
					v-for="i in 50" 
					:key="i" 
					:class="[
						'w-1.5 rounded-full transition-colors',
						(i / 50) <= (currentTime / duration) ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-800'
					]" 
					:style="{ height: `${20 + Math.random() * 60}%` }"
				/>
			</div>
			<div
				class="absolute top-0 bottom-0 w-0.5 bg-primary-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] z-20 pointer-events-none transition-all duration-75"
				:style="{ left: `${(currentTime / duration) * 100 || 0}%` }"
			/>
		</div>

		<audio
			ref="audioElement"
			:src="audioSrc"
			class="hidden"
			@timeupdate="handleTimeUpdate"
			@loadedmetadata="handleLoadedMetadata"
			@ended="emit('ended')"
		/>
	</div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
