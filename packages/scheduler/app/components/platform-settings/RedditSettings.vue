<script lang="ts" setup>
/**
 *
 * Component Description: Reddit platform settings for subreddit selection and post type
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { RedditSettings, RedditSubreddit } from '#layers/BaseScheduler/shared/platformSettings';

const settings = defineModel<RedditSettings>({ required: true });

const postTypes = [
    { label: 'Text Post', value: 'self' },
    { label: 'Link Post', value: 'link' },
    { label: 'Image Post', value: 'image' },
    { label: 'Video Post', value: 'video' },
];

const ensureSubreddit = () => {
    if (!settings.value.subreddit) {
        settings.value.subreddit = {
            value: '',
            title: '',
            type: '',
            url: '',
            is_flair_required: false,
        };
    }
};

const ensureFlair = () => {
    ensureSubreddit();
    if (!settings.value.subreddit!.flair) {
        settings.value.subreddit!.flair = { id: '', name: '' };
    }
};

const isLinkPost = computed(() => settings.value.type === 'link');
const requiresFlair = computed(() => settings.value.subreddit?.is_flair_required);

const subredditValue = computed({
    get: () => settings.value.subreddit?.value || '',
    set: (val: string) => {
        ensureSubreddit();
        settings.value.subreddit!.value = val;
    }
});

const flairRequired = computed({
    get: () => settings.value.subreddit?.is_flair_required || false,
    set: (val: boolean) => {
        ensureSubreddit();
        settings.value.subreddit!.is_flair_required = val;
    }
});

const flairId = computed({
    get: () => settings.value.subreddit?.flair?.id || '',
    set: (val: string) => {
        ensureFlair();
        settings.value.subreddit!.flair!.id = val;
    }
});

const flairName = computed({
    get: () => settings.value.subreddit?.flair?.name || '',
    set: (val: string) => {
        ensureFlair();
        settings.value.subreddit!.flair!.name = val;
    }
});
</script>

<template>
    <div class="space-y-4">
        <UFormGroup label="Post Type">
            <USelect v-model="settings.type" :items="postTypes" placeholder="Select post type" />
        </UFormGroup>

        <UFormGroup v-if="isLinkPost" label="Link URL">
            <UInput v-model="settings.url" placeholder="https://example.com/article" />
        </UFormGroup>

        <UFormGroup label="Subreddit">
            <UInput v-model="subredditValue" placeholder="programming">
                <template #leading>
                    <span class="text-muted">r/</span>
                </template>
            </UInput>
        </UFormGroup>

        <UFormGroup>
            <UCheckbox v-model="flairRequired" label="This subreddit requires flair" />
        </UFormGroup>

        <template v-if="requiresFlair">
            <UFormGroup label="Flair ID">
                <UInput v-model="flairId" placeholder="Flair ID" />
            </UFormGroup>
            <UFormGroup label="Flair Name">
                <UInput v-model="flairName" placeholder="Flair name" />
            </UFormGroup>
        </template>
    </div>
</template>

<style scoped></style>
