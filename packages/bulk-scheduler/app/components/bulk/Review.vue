<script setup lang="ts">
/**
 * Component Description: Review step component
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const { t } = useI18n()

const props = defineProps<{
    scheduledPosts: any[]
    isScheduling: boolean
    config: any
}>()

const emit = defineEmits(['schedule', 'back'])
</script>

<template>
    <div class="space-y-6">
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
            <h3 class="font-bold text-lg mb-2">{{ t('review.title', { count: scheduledPosts.length }) }}</h3>
            <p class="text-gray-600 dark:text-gray-300">
                {{ t('review.summary', { date: config.startDate, time: config.defaultTime, count: config.postsPerDay })
                }}
            </p>
        </div>

        <div class="border dark:border-gray-700 rounded-lg divide-y dark:divide-gray-700 max-h-96 overflow-y-auto">
            <div v-for="(post, index) in scheduledPosts" :key="index"
                class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div class="flex justify-between text-xs text-gray-500 mb-1">
                    <span class="flex items-center">
                        <UIcon name="i-heroicons-calendar" class="w-3 h-3 mr-1" /> {{ new
                            Date(post.scheduledAt).toLocaleString() }}
                    </span>
                    <span class="flex items-center">
                        <UIcon name="i-heroicons-users" class="w-3 h-3 mr-1" /> {{ t('review.accountCount', {
                            count:
                                post.targetPlatforms.length }) }}
                    </span>
                </div>
                <div class="font-medium text-sm">{{ post.content }}</div>
            </div>
        </div>

        <div class="flex justify-between mt-6">
            <UButton color="gray" variant="ghost" icon="i-heroicons-arrow-left" @click="$emit('back')">{{
                t('config.backBtn') }}</UButton>
            <UButton color="primary" @click="$emit('schedule')" :loading="isScheduling"
                icon="i-heroicons-paper-airplane">{{ t('review.confirmBtn') }}</UButton>
        </div>
    </div>
</template>
