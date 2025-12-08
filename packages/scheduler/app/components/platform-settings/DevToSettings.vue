<script lang="ts" setup>
/**
 *
 * Component Description: Dev.to platform settings for article title, tags, and canonical URL
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { DevToSettings } from '#layers/BaseScheduler/shared/platformSettings';

const settings = defineModel<DevToSettings>({ required: true });

const tagInput = ref('');

const addTag = () => {
    if (!tagInput.value.trim()) return;
    if (!settings.value.tags) {
        settings.value.tags = [];
    }
    if (settings.value.tags.length >= 4) return;

    settings.value.tags.push({
        value: tagInput.value.toLowerCase().replace(/\s+/g, ''),
        label: tagInput.value
    });
    tagInput.value = '';
};

const removeTag = (index: number) => {
    settings.value.tags?.splice(index, 1);
};

const canAddMoreTags = computed(() => (settings.value.tags?.length || 0) < 4);
</script>

<template>
    <div class="space-y-4">
        <UFormGroup label="Article Title" hint="Required for Dev.to posts">
            <UInput v-model="settings.title" placeholder="My Awesome Article" />
        </UFormGroup>

        <UFormGroup label="Canonical URL" hint="Original source if cross-posting">
            <UInput v-model="settings.canonical" placeholder="https://myblog.com/original-article" />
        </UFormGroup>

        <UFormGroup label="Tags" :hint="`${settings.tags?.length || 0}/4 tags`">
            <div class="space-y-2">
                <div class="flex flex-wrap gap-2">
                    <UBadge v-for="(tag, index) in settings.tags" :key="index" color="primary" variant="subtle"
                        class="flex items-center gap-1">
                        {{ tag.label }}
                        <button type="button" class="ml-1 hover:text-red-500" @click="removeTag(index)">
                            <Icon name="i-heroicons-x-mark" class="w-3 h-3" />
                        </button>
                    </UBadge>
                </div>
                <div v-if="canAddMoreTags" class="flex gap-2">
                    <UInput v-model="tagInput" placeholder="Add tag..." class="flex-1" @keyup.enter="addTag" />
                    <UButton icon="i-heroicons-plus" variant="ghost" @click="addTag" />
                </div>
            </div>
        </UFormGroup>
    </div>
</template>

<style scoped></style>
