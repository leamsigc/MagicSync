<script lang="ts" setup>
/**
 * Component Description: Thread and comment management
 */

interface Props {
    comments: string[];
}

const props = defineProps<Props>();
const emit = defineEmits(['add-comment', 'remove-comment', 'update-comment']);

const newComment = ref('');

const handleAdd = () => {
    if (!newComment.value.trim()) return;
    emit('add-comment', newComment.value);
    newComment.value = '';
};

const handleRemove = (index: number) => {
    emit('remove-comment', index);
};
</script>

<template>
    <div class="border-t border-zinc-800/50 bg-zinc-900/30">
        <div class="p-4">
            <div class="flex items-center justify-between mb-4">
                <h4 class="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <Icon name="lucide:message-circle" class="w-4 h-4" />
                    Thread / Comments ({{ comments.length }})
                </h4>
                <button @click="handleAdd" class="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                    + Add Comment
                </button>
            </div>

            <!-- Existing Comments -->
            <div v-if="comments.length > 0" class="space-y-3 mb-4">
                <div v-for="(comment, idx) in comments" :key="idx" class="flex gap-3 group">
                    <div class="flex flex-col items-center">
                        <div
                            class="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">
                            {{ idx + 1 }}
                        </div>
                        <div v-if="idx < comments.length - 1" class="w-px h-full bg-zinc-800 my-1"></div>
                    </div>
                    <div class="flex-1">
                        <div
                            class="bg-zinc-900 rounded-lg p-3 border border-zinc-800 group-hover:border-zinc-700 transition-colors relative">
                            <p class="text-sm text-zinc-300">{{ comment }}</p>
                            <button @click="handleRemove(idx)"
                                class="absolute top-2 right-2 p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Icon name="lucide:x" class="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Input for new comment -->
            <div class="flex gap-3">
                <div class="w-6 flex justify-center pt-2">
                    <div class="w-1.5 h-1.5 rounded-full bg-zinc-700"></div>
                </div>
                <div class="flex-1">
                    <UInput v-model="newComment" placeholder="Add a follow-up comment..." variant="none"
                        class="bg-zinc-900 border border-zinc-800 rounded-lg focus:ring-1 focus:ring-indigo-500/50"
                        @keydown.enter.prevent="handleAdd">
                        <template #trailing>
                            <button v-if="newComment" @click="handleAdd"
                                class="text-indigo-400 hover:text-indigo-300 p-1">
                                <Icon name="lucide:send-horizontal" class="w-4 h-4" />
                            </button>
                        </template>
                    </UInput>
                </div>
            </div>
        </div>
    </div>
</template>
