<script lang="ts" setup>
/**
 *
 * Component Description: Facebook platform settings for link preview URLs
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { FacebookSettings } from '#layers/BaseShared/shared/platformSettings';

const settings = defineModel<FacebookSettings>({ required: true });
</script>

<template>
    <div class="space-y-4">
        <UFormField label="Link Preview URL" hint="URL to show as a link preview in your post">
            <UInput v-model="settings.url" placeholder="https://example.com/article" />
        </UFormField>
    </div>
</template>

<style scoped></style>
