<script lang="ts" setup>
/**
 *
 * Component Description: LinkedIn platform settings for carousel toggle
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { LinkedInSettings } from '#layers/BaseScheduler/shared/platformSettings';

const settings = defineModel<LinkedInSettings>({ required: true });
</script>

<template>
    <div class="space-y-4">
        <UFormGroup>
            <UCheckbox v-model="settings.post_as_images_carousel" label="Post images as carousel"
                help="When enabled, multiple images will be posted as a carousel/document" />
        </UFormGroup>
    </div>
</template>

<style scoped></style>
