<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'

/**
 * Component Description: AI Import step component
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const { t } = useI18n()
const toast = useToast()

const parsedPosts = defineModel<any[]>('parsedPosts', { required: true })
const emit = defineEmits(['next'])

// AI Chat
const { messages, input, handleSubmit, isLoading: isAiLoading } = useChat({
    api: '/api/v1/ai/chat',
    onToolCall: ({ toolCall }) => {
        if (toolCall.toolName === 'generateBulkPosts') {
            toast.add({ title: 'Generating', description: 'AI is generating your posts...', color: 'blue' })
        }
    },
    onFinish: (message) => {
        if (message.toolInvocations) {
            for (const toolInvocation of message.toolInvocations) {
                if (toolInvocation.toolName === 'generateBulkPosts' && toolInvocation.state === 'result') {
                    const result = toolInvocation.result;
                    if (Array.isArray(result)) {
                        parsedPosts.value = result.map((r: any) => ({
                            content: r.content,
                            image: undefined
                        }))
                        toast.add({ title: 'Success', description: `${result.length} posts generated!`, color: 'green' })
                    }
                }
            }
        }
    }
})
</script>

<template>
    <div class="space-y-4">
        <div class="mt-4 flex flex-col h-[500px] border dark:border-gray-700 rounded-lg overflow-hidden">
            <!-- Chat Messages -->
            <div class="flex-1 overflow-y-auto p-4 space-y-4">
                <div v-if="messages.length === 0" class="text-center text-gray-400 mt-10">
                    <UIcon name="i-heroicons-sparkles" class="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Ask me to generate posts for you!</p>
                    <p class="text-xs mt-1">Example: "Generate 10 tweets about AI trends"</p>
                </div>

                <div v-for="m in messages" :key="m.id" class="flex"
                    :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
                    <div class="max-w-[85%] rounded-lg p-3 text-sm shadow-sm"
                        :class="m.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'">
                        <p class="whitespace-pre-wrap">{{ m.content }}</p>

                        <!-- Tool invocations display -->
                        <div v-if="m.toolInvocations"
                            class="mt-2 text-xs border-t border-black/10 dark:border-white/10 pt-2 opacity-90">
                            <div v-for="t in m.toolInvocations" :key="t.toolCallId">
                                <div v-if="t.toolName === 'generateBulkPosts'" class="flex items-center gap-1">
                                    <UIcon name="i-heroicons-cog" class="w-3 h-3 animate-spin"
                                        v-if="t.state !== 'result'" />
                                    <UIcon name="i-heroicons-check-circle" class="w-3 h-3 text-green-500"
                                        v-if="t.state === 'result'" />
                                    {{ t.state === 'result' ? `Generated posts` : 'Generating posts...' }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Chat Input -->
            <div class="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <form @submit.prevent="handleSubmit" class="flex gap-2">
                    <UInput v-model="input" placeholder="Type a message..." class="flex-1" :disabled="isAiLoading"
                        autofocus size="lg" />
                    <UButton type="submit" icon="i-heroicons-paper-airplane" :loading="isAiLoading"
                        :disabled="!input.trim()">Send</UButton>
                </form>
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
