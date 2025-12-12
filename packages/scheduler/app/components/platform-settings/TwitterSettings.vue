<script lang="ts" setup>
/**
 *
 * Component Description: Twitter platform settings for reply restrictions and community posting
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { TwitterSettings } from '#layers/BaseScheduler/shared/platformSettings';

const settings = defineModel<TwitterSettings>({ required: true });

const replyOptions = [
    { label: 'Everyone', value: 'everyone' },
    { label: 'Accounts you follow', value: 'following' },
    { label: 'Mentioned users only', value: 'mentionedUsers' },
    { label: 'Subscribers only', value: 'subscribers' },
    { label: 'Verified accounts only', value: 'verified' },
];
</script>

<template>
    <div class="space-y-4">
        <UFormField label="Who can reply">
            <USelect v-model="settings.who_can_reply" :items="replyOptions" placeholder="Select reply restrictions" />
        </UFormField>
        <UFormField label="Community URL" hint="Paste your X Community URL to post to a community">
            <UInput v-model="settings.community" placeholder="https://x.com/i/communities/..." />
        </UFormField>
    </div>
</template>

<style scoped></style>
