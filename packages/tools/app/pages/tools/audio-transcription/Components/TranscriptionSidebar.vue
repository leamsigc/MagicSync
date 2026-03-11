<script setup lang="ts">
/**
 *
 * Component Description: Sidebar for displaying transcription metadata and engine metrics
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
defineProps<{
	modelName: string
	language: string
	isProcessing: boolean
}>()

const emit = defineEmits<{
	(e: 'download', format: 'text' | 'json' | 'timestamps'): void
	(e: 'rerun'): void
}>()

</script>

<template>
	<div class="space-y-6">
		<div class="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
			<h3 class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-200 dark:border-gray-800 pb-2">Content Summary</h3>
			
			<div class="space-y-4">
				<div class="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-gray-800/50">
					<span class="text-[10px] block text-gray-400 mb-1">Topic Focus</span>
					<p class="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">Audio Transcription Review</p>
				</div>
				
				<div class="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-gray-800/50">
					<span class="text-[10px] block text-gray-400 mb-2">Keywords</span>
					<div class="flex flex-wrap gap-2">
						<UBadge color="primary" variant="soft" class="uppercase tracking-widest text-[10px] font-bold">Whisper</UBadge>
						<UBadge color="primary" variant="soft" class="uppercase tracking-widest text-[10px] font-bold">Latency</UBadge>
						<UBadge color="primary" variant="soft" class="uppercase tracking-widest text-[10px] font-bold">Privacy</UBadge>
					</div>
				</div>
			</div>
		</div>

		<div class="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
			<h3 class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">Transcription Engine</h3>
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<span class="text-xs text-gray-500 dark:text-gray-400">Model</span>
					<span class="text-xs font-mono font-medium text-gray-900 dark:text-gray-200">{{ modelName }}</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-xs text-gray-500 dark:text-gray-400">Language</span>
					<span class="text-xs font-medium text-gray-900 dark:text-gray-200">{{ language }}</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-xs text-gray-500 dark:text-gray-400">Word Accuracy</span>
					<span class="text-xs font-bold text-primary-500 dark:text-primary-400 tracking-widest">98.4%</span>
				</div>
				<div class="flex items-center justify-between mb-4">
					<span class="text-xs text-gray-500 dark:text-gray-400">Processing Time</span>
					<span class="text-xs font-mono text-gray-900 dark:text-gray-200">1m 12s</span>
				</div>
				
				<div class="h-px bg-gray-200 dark:bg-gray-800 my-4"/>
				
				<div class="grid grid-cols-2 gap-3">
					<UButton 
						size="sm" 
						color="neutral" 
						variant="outline" 
						icon="i-lucide-file-text" 
						class="w-full justify-center" 
						@click="emit('download', 'text')"
					>
						{{ t('download_text') }}
					</UButton>
					<UButton 
						size="sm" 
						color="neutral" 
						variant="outline" 
						icon="i-lucide-braces" 
						class="w-full justify-center" 
						@click="emit('download', 'json')"
					>
						{{ t('download_json') }}
					</UButton>
				</div>
				<UButton 
					color="primary" 
					variant="solid" 
					class="w-full justify-center mt-2" 
					:disabled="isProcessing"
					@click="emit('rerun')"
				>
					Re-run transcription
				</UButton>
			</div>
		</div>
	</div>
</template>
