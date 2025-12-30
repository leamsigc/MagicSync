<script setup lang="ts">
import Papa from 'papaparse'

/**
 * Component Description: CSV Import step component
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const { t } = useI18n()
const toast = useToast()

const parsedPosts = defineModel<any[]>('parsedPosts', { required: true })
const emit = defineEmits(['next'])

const handleFileUpload = (files: FileList) => {
    const file = files?.[0]
    if (!file) return
    parseCSVFile(file)
}

const parseCSVFile = (file: File) => {
    Papa.parse(file, {
        complete: (results) => {
            if (results.data && Array.isArray(results.data)) {
                parsedPosts.value = results.data
                    .filter((row: any) => row[0])
                    .map((row: any) => ({
                        content: row[0],
                        image: row[1] || undefined
                    }))
                toast.add({ title: 'Success', description: `Imported ${parsedPosts.value.length} posts`, color: 'green' })
            }
        },
        error: (err) => {
            toast.add({ title: 'Error', description: 'Failed to parse CSV', color: 'red' })
        },
        header: false
    })
}
</script>

<template>
    <div class="space-y-4">
        <div
            class="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center transition-colors mt-4 bg-gray-50 dark:bg-gray-800/50">
            <div class="flex flex-col items-center justify-center space-y-4">
                <UIcon name="i-heroicons-document-arrow-up" class="w-12 h-12 text-gray-400" />
                <div class="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {{ t('import.uploadText') }}
                </div>
                <UInput type="file" accept=".csv" @change="handleFileUpload" icon="i-heroicons-folder-open" />
            </div>
        </div>

        <div v-if="parsedPosts.length > 0" class="mt-6 border dark:border-gray-700 rounded-lg p-4">
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold flex items-center">
                    <UIcon name="i-heroicons-document-text" class="w-5 h-5 mr-2" />
                    {{ t('import.previewTitle', { count: parsedPosts.length }) }}
                </h3>
                <UButton size="2xs" color="gray" variant="ghost" icon="i-heroicons-trash" @click="parsedPosts = []">{{
                    t('import.clearBtn') }}</UButton>
            </div>
            <div class="max-h-60 overflow-y-auto space-y-2">
                <div v-for="(post, idx) in parsedPosts.slice(0, 100)" :key="idx"
                    class="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm flex justify-between items-start">
                    <span>{{ post.content }}</span>
                    <UBadge v-if="post.image" color="blue" size="xs" variant="subtle">Image</UBadge>
                </div>
            </div>
        </div>

        <div class="flex justify-end mt-4">
            <UButton @click="$emit('next')" :disabled="parsedPosts.length === 0"
                trailing-icon="i-heroicons-arrow-right">{{ t('import.nextBtn') }}</UButton>
        </div>
    </div>
</template>
