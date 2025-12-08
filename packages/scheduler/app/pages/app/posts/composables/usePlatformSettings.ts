/**
 *
 * Component Description: Composable for managing platform-specific settings in posts
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the composable
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { PlatformSettings } from '#layers/BaseScheduler/shared/platformSettings';
import { createDefaultSettings } from '#layers/BaseScheduler/shared/platformSettings';

export type PlatformContentOverride = {
    content: string;
    comments?: string[];
};

export const usePlatformSettings = () => {
    const selectedPlatform = ref<string>('default');
    const masterContent = ref<string>('');
    const masterComments = ref<string[]>([]);
    const platformContent = ref<Record<string, PlatformContentOverride>>({});
    const platformSettings = ref<Record<string, PlatformSettings>>({});
    const postFormat = ref<'post' | 'reel' | 'story' | 'short'>('post');

    const currentContent = computed({
        get() {
            if (selectedPlatform.value === 'default') {
                return masterContent.value;
            }
            return platformContent.value[selectedPlatform.value]?.content ?? masterContent.value;
        },
        set(value: string) {
            if (selectedPlatform.value === 'default') {
                masterContent.value = value;
            } else {
                if (!platformContent.value[selectedPlatform.value]) {
                    platformContent.value[selectedPlatform.value] = { content: value };
                } else {
                    platformContent.value[selectedPlatform.value]!.content = value;
                }
            }
        }
    });

    const currentComments = computed({
        get() {
            if (selectedPlatform.value === 'default') {
                return masterComments.value;
            }
            return platformContent.value[selectedPlatform.value]?.comments ?? masterComments.value;
        },
        set(value: string[]) {
            if (selectedPlatform.value === 'default') {
                masterComments.value = value;
            } else {
                if (!platformContent.value[selectedPlatform.value]) {
                    platformContent.value[selectedPlatform.value] = {
                        content: masterContent.value,
                        comments: value
                    };
                } else {
                    platformContent.value[selectedPlatform.value]!.comments = value;
                }
            }
        }
    });

    const currentSettings = computed(() => {
        if (selectedPlatform.value === 'default') return null;
        return platformSettings.value[selectedPlatform.value] || createDefaultSettings(selectedPlatform.value);
    });

    const hasPlatformOverride = (platform: string): boolean => !!platformContent.value[platform]?.content;

    const hasPlatformSettings = (platform: string): boolean => !!platformSettings.value[platform];

    const getContentForPlatform = (platform: string): string =>
        platformContent.value[platform]?.content || masterContent.value;

    const getCommentsForPlatform = (platform: string): string[] =>
        platformContent.value[platform]?.comments || masterComments.value;

    const addComment = () => {
        currentComments.value = [...currentComments.value, ''];
    };

    const removeComment = (index: number) => {
        const comments = [...currentComments.value];
        comments.splice(index, 1);
        currentComments.value = comments;
    };

    const updateComment = (index: number, value: string) => {
        const comments = [...currentComments.value];
        comments[index] = value;
        currentComments.value = comments;
    };

    const clearPlatformOverride = (platform: string) => {
        delete platformContent.value[platform];
    };

    const updatePlatformSettings = (platform: string, settings: PlatformSettings) => {
        platformSettings.value[platform] = settings;
    };

    return {
        selectedPlatform,
        masterContent,
        masterComments,
        platformContent,
        platformSettings,
        postFormat,
        currentContent,
        currentComments,
        currentSettings,
        hasPlatformOverride,
        hasPlatformSettings,
        getContentForPlatform,
        getCommentsForPlatform,
        addComment,
        removeComment,
        updateComment,
        clearPlatformOverride,
        updatePlatformSettings,
    };
};
