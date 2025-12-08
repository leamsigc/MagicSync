<script lang="ts" setup>
/**
 *
 * Component Description: WordPress platform settings for post title and type
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { WordPressSettings } from '#layers/BaseScheduler/shared/platformSettings';

const settings = defineModel<WordPressSettings>({ required: true });

const postTypes = [
    { label: 'Blog Post', value: 'post' },
    { label: 'Page', value: 'page' },
];
</script>

<template>
    <div class="space-y-4">
        <UFormGroup label="Post Title" hint="Required for WordPress posts">
            <UInput v-model="settings.title" placeholder="My Blog Post Title" />
        </UFormGroup>

        <UFormGroup label="Post Type">
            <USelect v-model="settings.type" :items="postTypes" placeholder="Select post type" />
        </UFormGroup>
    </div>
</template>

<style scoped></style>
