<script lang="ts" setup>
/**
 * Canvas Size Presets Sidebar
 *
 * Displays visual thumbnails for different canvas sizes
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 */
import type { AspectRatios } from '../composables/useTextStyles';

interface Props {
    aspectRatios: AspectRatios;
    aspectRatio: keyof AspectRatios;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    'update:aspect-ratio': [ratio: keyof AspectRatios];
}>();

// Group presets by category
const presetGroups = computed(() => {
    return [
        {
            name: 'Instagram',
            presets: [
                { key: '1:1' as keyof AspectRatios, label: 'Square' },
                { key: '4:5' as keyof AspectRatios, label: 'Portrait' },
                { key: '16:9' as keyof AspectRatios, label: 'Landscape' },
                { key: '9:16' as keyof AspectRatios, label: 'Story' },
            ],
        },
        {
            name: 'Facebook',
            presets: [
                { key: '1200:628' as keyof AspectRatios, label: 'Share' },
                { key: '851:315' as keyof AspectRatios, label: 'Cover' },
            ],
        },
        {
            name: 'Twitter',
            presets: [
                { key: '1500:500' as keyof AspectRatios, label: 'Header' },
                { key: '1024:512' as keyof AspectRatios, label: 'Post' },
            ],
        },
        {
            name: 'LinkedIn',
            presets: [
                { key: '1584:396' as keyof AspectRatios, label: 'Cover' },
                { key: '1200:627' as keyof AspectRatios, label: 'Post' },
            ],
        },
        {
            name: 'Other',
            presets: [
                { key: 'custom' as keyof AspectRatios, label: 'Custom' },
                { key: 'image' as keyof AspectRatios, label: 'Image' },
            ],
        },
    ];
});

// Calculate aspect ratio for visual representation
const getAspectRatioStyle = (key: keyof AspectRatios) => {
    const ratio = props.aspectRatios[key];
    if (!ratio || ratio.width === 0 || ratio.height === 0) {
        return { paddingBottom: '100%' };
    }

    const aspectPercent = (ratio.height / ratio.width) * 100;
    return { paddingBottom: `${Math.min(aspectPercent, 150)}%` };
};

const selectPreset = (key: keyof AspectRatios) => {
    emit('update:aspect-ratio', key);
};
</script>

<template>
    <aside class="w-20 bg-gray-900 border-r border-gray-800 p-2 overflow-y-auto">
        <div class="space-y-4">
            <div v-for="group in presetGroups" :key="group.name" class="space-y-2">
                <!-- Group Label -->
                <div class="text-xs text-gray-500 font-medium px-1">
                    {{ group.name }}
                </div>

                <!-- Preset Thumbnails -->
                <div class="space-y-2">
                    <button v-for="preset in group.presets" :key="preset.key"
                        :title="`${props.aspectRatios[preset.key]?.label || preset.label}`" :class="[
                            'w-full aspect-square rounded-lg border-2 transition-all duration-200 relative overflow-hidden group',
                            aspectRatio === preset.key
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                        ]" @click="selectPreset(preset.key)">
                        <!-- Visual representation of aspect ratio -->
                        <div class="absolute inset-2 flex items-center justify-center">
                            <div class="bg-gray-700 rounded" :class="[
                                aspectRatio === preset.key ? 'bg-blue-500/30' : 'bg-gray-700'
                            ]" :style="{
                    width: preset.key === 'custom' || preset.key === 'image' ? '60%' : '100%',
                    ...getAspectRatioStyle(preset.key)
                }" />
                        </div>

                        <!-- Label on hover -->
                        <div
                            class="absolute inset-0 bg-gray-900/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span class="text-xs text-white font-medium text-center px-1">
                                {{ preset.label }}
                            </span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    </aside>
</template>

<style scoped>
/* Custom scrollbar */
aside::-webkit-scrollbar {
    width: 4px;
}

aside::-webkit-scrollbar-track {
    background: #1f2937;
}

aside::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 2px;
}

aside::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
}
</style>
