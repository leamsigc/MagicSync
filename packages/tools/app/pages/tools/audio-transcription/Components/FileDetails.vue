<script setup lang="ts">
/**
 *
 * Component Description: Main view wrapping the player, transcript tabs, and sidebar
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { TranscriptionFile } from '~/composables/useTranscription'
import TranscriptionPlayer from './TranscriptionPlayer.vue'
import TranscriptionSidebar from './TranscriptionSidebar.vue'

const props = defineProps<{
	selectedFile: TranscriptionFile
	audioSrc: string
	currentModel: string
	currentLanguage: string
	isProcessing: boolean
}>()

const emit = defineEmits<{
	(e: 'download', id: string, format: 'text' | 'json' | 'timestamps'): void
	(e: 'transcribe', id: string): void
}>()


const activeTab = ref('text')
const currentTime = ref(0)
const duration = ref(0)
const isPlaying = ref(false)

const resultTabs = [
	{ label: 'Transcript', value: 'text', icon: 'i-lucide-file-text', slot: 'text' as const },
	{ label: 'Timestamps', value: 'timestamps', icon: 'i-lucide-clock', slot: 'timestamps' as const },
	{ label: 'Raw JSON', value: 'json', icon: 'i-lucide-braces', slot: 'json' as const },
]

function formatTime(seconds: number) {
	if (!seconds) return '0:00'
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getCurrentChunk() {
	if (!props.selectedFile?.result?.chunks) return null
	return props.selectedFile.result.chunks.find(chunk => 
		currentTime.value >= chunk.start && currentTime.value <= chunk.end
	)
}

const currentText = computed(() => getCurrentChunk()?.text)
</script>

<template>
	<div v-motion-fade class="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
		<div class="flex justify-between items-end mb-8">
			<div class="flex items-center gap-4">
				<h2 class="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{{ selectedFile.name }}</h2>
				<span class="px-2 py-0.5 mt-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[10px] tracking-widest font-bold uppercase border border-gray-200 dark:border-gray-700">Draft Auto-saved</span>
			</div>
			<div class="flex items-center gap-3">
				<UButton color="neutral" variant="outline" icon="i-lucide-save">Local Save</UButton>
				<UDropdownMenu
					:items="[
						[{ label: 'Text (.txt)', onSelect: () => emit('download', selectedFile.id, 'text') }],
						[{ label: 'JSON (.json)', onSelect: () => emit('download', selectedFile.id, 'json') }],
						[{ label: 'Timestamps (.txt)', onSelect: () => emit('download', selectedFile.id, 'timestamps') }]
					]"
				>
					<UButton color="primary" variant="solid" trailing-icon="i-lucide-chevron-down">
						Export
					</UButton>
				</UDropdownMenu>
			</div>
		</div>

		<div v-if="selectedFile.result || selectedFile.status === 'transcribing'" class="grid grid-cols-12 gap-8">
			<div class="col-span-12 lg:col-span-8 space-y-6">
				<TranscriptionPlayer
					v-model:current-time="currentTime"
					:audio-src="audioSrc"
					:duration="duration"
					:is-playing="isPlaying"
					:current-text="currentText"
					@toggle-playback="isPlaying = !isPlaying"
					@loadedmetadata="d => duration = d"
					@ended="isPlaying = false"
				/>

				<div class="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
					<UTabs v-model="activeTab" :items="resultTabs" class="w-full">
						<template #text>
							<div class="prose prose-sm dark:prose-invert max-w-none mt-6">
								<p v-if="selectedFile.result?.text" class="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300">{{ selectedFile.result.text }}</p>
								<div v-else-if="selectedFile.status === 'transcribing'" class="space-y-3 mt-4">
									<USkeleton class="h-4 w-[90%]" />
									<USkeleton class="h-4 w-[85%]" />
									<USkeleton class="h-4 w-[95%]" />
									<p class="text-xs text-gray-400 animate-pulse font-medium mt-4 uppercase tracking-widest">Streaming transcription chunks...</p>
								</div>
							</div>
						</template>

						<template #timestamps>
							<div class="space-y-4 max-h-[500px] overflow-y-auto mt-6 pr-4 custom-scrollbar">
								<template v-if="selectedFile.result?.chunks?.length">
									<div
										v-for="(chunk, idx) in selectedFile.result.chunks"
										:key="idx"
										:class="[
											'flex gap-6 p-4 rounded-xl cursor-pointer transition-all',
											(currentTime >= chunk.start && currentTime <= chunk.end) 
												? 'bg-primary-50 dark:bg-primary-900/10 border-l-2 border-primary-500' 
												: 'hover:bg-gray-100 dark:hover:bg-gray-800/50 border-l-2 border-transparent'
										]"
										@click="currentTime = chunk.start; isPlaying = true"
									>
										<div class="w-16 shrink-0 mt-1 flex flex-col items-end">
											<span
												:class="[
													'text-[10px] font-bold tracking-widest',
													(currentTime >= chunk.start && currentTime <= chunk.end) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'
												]">
												{{ formatTime(chunk.start) }}
											</span>
										</div>
										<div class="flex-1">
											<!-- Diarization concept: Alternate speaker labels for demo purposes -->
											<div class="flex items-center gap-2 mb-1">
												<span
													:class="[
														'text-[10px] font-bold tracking-widest uppercase',
														idx % 2 === 0 ? 'text-blue-500' : 'text-purple-500' 
													]">SPEAKER {{ idx % 2 === 0 ? '1' : '2' }}</span>
												<UIcon name="i-lucide-pencil" class="text-xs text-gray-400 hover:text-primary-500 cursor-pointer" />
											</div>
											<p
												:class="[
													'text-sm leading-relaxed transition-colors',
													(currentTime >= chunk.start && currentTime <= chunk.end) ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
												]">
												{{ chunk.text }}
											</p>
										</div>
									</div>
								</template>
								<div v-else-if="selectedFile.status === 'transcribing'" class="flex flex-col items-center justify-center py-12 text-center text-gray-500">
									<UIcon name="i-lucide-loader-2" class="text-3xl animate-spin mb-4 text-primary-500" />
									<p class="text-sm font-medium tracking-tight">AI is analyzing audio segments...</p>
									<p class="text-[10px] uppercase tracking-widest mt-2 font-bold opacity-50">Expect chunks every few seconds</p>
								</div>
							</div>
						</template>

						<template #json>
							<div class="bg-gray-900 p-4 rounded-xl overflow-auto max-h-[500px] mt-6">
								<pre class="text-xs font-mono text-gray-300 custom-scrollbar">{{ JSON.stringify(selectedFile.result, null, 2) }}</pre>
							</div>
						</template>
					</UTabs>
				</div>
			</div>

			<div class="col-span-12 lg:col-span-4">
				<TranscriptionSidebar
					:model-name="currentModel"
					:language="currentLanguage"
					:is-processing="isProcessing"
					@download="f => emit('download', selectedFile.id, f)"
					@rerun="emit('transcribe', selectedFile.id)"
				/>
			</div>
		</div>
	</div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
	width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
	background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
	background: #3f3f46;
	border-radius: 10px;
}
</style>
