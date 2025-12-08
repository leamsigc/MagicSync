<script lang="ts" setup>
/**
 *
 * Component Description: Container component for dynamically loading platform-specific settings
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { PlatformSettings } from '#layers/BaseScheduler/shared/platformSettings';
import { createDefaultSettings } from '#layers/BaseScheduler/shared/platformSettings';

type Props = {
    platform: string;
};

const props = defineProps<Props>();
const modelValue = defineModel<Record<string, PlatformSettings>>({ required: true });

const platformComponentMap: Record<string, ReturnType<typeof defineAsyncComponent>> = {
    twitter: defineAsyncComponent(() => import('./platform-settings/TwitterSettings.vue')),
    x: defineAsyncComponent(() => import('./platform-settings/TwitterSettings.vue')),
    facebook: defineAsyncComponent(() => import('./platform-settings/FacebookSettings.vue')),
    instagram: defineAsyncComponent(() => import('./platform-settings/InstagramSettings.vue')),
    'instagram-standalone': defineAsyncComponent(() => import('./platform-settings/InstagramSettings.vue')),
    linkedin: defineAsyncComponent(() => import('./platform-settings/LinkedInSettings.vue')),
    'linkedin-page': defineAsyncComponent(() => import('./platform-settings/LinkedInSettings.vue')),
    google: defineAsyncComponent(() => import('./platform-settings/GoogleBusinessSettings.vue')),
    googlemybusiness: defineAsyncComponent(() => import('./platform-settings/GoogleBusinessSettings.vue')),
    reddit: defineAsyncComponent(() => import('./platform-settings/RedditSettings.vue')),
    devto: defineAsyncComponent(() => import('./platform-settings/DevToSettings.vue')),
    wordpress: defineAsyncComponent(() => import('./platform-settings/WordPressSettings.vue')),
};

const showPanel = computed(() =>
    props.platform !== 'default' && !!platformComponentMap[props.platform]
);

const currentComponent = computed(() =>
    platformComponentMap[props.platform] || null
);

const currentSettings = computed({
    get() {
        if (!modelValue.value[props.platform]) {
            const defaults = createDefaultSettings(props.platform);
            if (defaults) {
                modelValue.value[props.platform] = defaults;
            }
        }
        return modelValue.value[props.platform];
    },
    set(value: PlatformSettings) {
        modelValue.value[props.platform] = value;
    }
});

const platformLabel = computed(() => {
    const labels: Record<string, string> = {
        twitter: 'Twitter/X',
        x: 'Twitter/X',
        facebook: 'Facebook',
        instagram: 'Instagram',
        'instagram-standalone': 'Instagram',
        linkedin: 'LinkedIn',
        'linkedin-page': 'LinkedIn Page',
        google: 'Google Business',
        googlemybusiness: 'Google Business',
        reddit: 'Reddit',
        devto: 'Dev.to',
        wordpress: 'WordPress',
    };
    return labels[props.platform] || props.platform;
});
</script>

<template>
    <div v-if="showPanel" class="border border-muted rounded-xl p-4 mt-4">
        <div class="flex items-center gap-2 mb-4">
            <Icon name="lucide:settings" class="w-4 h-4 text-primary" />
            <h4 class="text-sm font-semibold">{{ platformLabel }} Settings</h4>
        </div>
        <Suspense>
            <component :is="currentComponent" v-model="currentSettings" />
            <template #fallback>
                <div class="flex items-center justify-center py-4">
                    <Icon name="lucide:loader-2" class="w-5 h-5 animate-spin text-muted" />
                </div>
            </template>
        </Suspense>
    </div>
</template>

<style scoped></style>
