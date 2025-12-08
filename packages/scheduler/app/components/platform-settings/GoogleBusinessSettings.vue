<script lang="ts" setup>
/**
 *
 * Component Description: Google Business platform settings for events, offers, and CTAs
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { GoogleBusinessSettings } from '#layers/BaseScheduler/shared/platformSettings';

const settings = defineModel<GoogleBusinessSettings>({ required: true });

const topicTypes = [
    { label: 'Standard Post', value: 'STANDARD' },
    { label: 'Event', value: 'EVENT' },
    { label: 'Offer', value: 'OFFER' },
];

const ctaTypes = [
    { label: 'None', value: '' },
    { label: 'Book', value: 'BOOK' },
    { label: 'Order Online', value: 'ORDER' },
    { label: 'Learn More', value: 'LEARN_MORE' },
    { label: 'Sign Up', value: 'SIGN_UP' },
    { label: 'Call', value: 'CALL' },
];

const isEvent = computed(() => settings.value.topicType === 'EVENT');
const isOffer = computed(() => settings.value.topicType === 'OFFER');
const hasCTA = computed(() => !!settings.value.callToActionType);
</script>

<template>
    <div class="space-y-4">
        <UFormGroup label="Post Type">
            <USelect v-model="settings.topicType" :items="topicTypes" placeholder="Select post type" />
        </UFormGroup>

        <UFormGroup label="Call to Action">
            <USelect v-model="settings.callToActionType" :items="ctaTypes" placeholder="Select CTA type" />
        </UFormGroup>

        <UFormGroup v-if="hasCTA" label="CTA URL">
            <UInput v-model="settings.callToActionUrl" placeholder="https://example.com/action" />
        </UFormGroup>

        <template v-if="isEvent">
            <UFormGroup label="Event Title">
                <UInput v-model="settings.eventTitle" placeholder="Event title" />
            </UFormGroup>
            <div class="grid grid-cols-2 gap-4">
                <UFormGroup label="Start Date">
                    <UInput v-model="settings.eventStartDate" type="date" />
                </UFormGroup>
                <UFormGroup label="Start Time">
                    <UInput v-model="settings.eventStartTime" type="time" />
                </UFormGroup>
                <UFormGroup label="End Date">
                    <UInput v-model="settings.eventEndDate" type="date" />
                </UFormGroup>
                <UFormGroup label="End Time">
                    <UInput v-model="settings.eventEndTime" type="time" />
                </UFormGroup>
            </div>
        </template>

        <template v-if="isOffer">
            <UFormGroup label="Coupon Code">
                <UInput v-model="settings.offerCouponCode" placeholder="SAVE20" />
            </UFormGroup>
            <UFormGroup label="Redeem URL">
                <UInput v-model="settings.offerRedeemUrl" placeholder="https://example.com/redeem" />
            </UFormGroup>
            <UFormGroup label="Terms & Conditions">
                <UTextarea v-model="settings.offerTerms" placeholder="Offer terms..." :rows="3" />
            </UFormGroup>
        </template>
    </div>
</template>

<style scoped></style>
