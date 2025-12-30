<script setup lang="ts">
/**
 * Component Description: Configuration step component
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const { t } = useI18n()

const config = defineModel<{ startDate: string, defaultTime: string, postsPerDay: number }>('config', { required: true })
const emit = defineEmits(['next', 'back'])
</script>

<template>
    <div class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UFormGroup :label="t('config.startDate')">
                <UInput type="date" v-model="config.startDate" icon="i-heroicons-calendar" />
            </UFormGroup>
            <UFormGroup :label="t('config.defaultTime')">
                <UInput type="time" v-model="config.defaultTime" icon="i-heroicons-clock" />
            </UFormGroup>
            <UFormGroup :label="t('config.postsPerDay')">
                <UInput type="number" v-model="config.postsPerDay" min="1" icon="i-heroicons-hashtag" />
            </UFormGroup>
        </div>

        <div class="flex justify-between mt-6">
            <UButton color="gray" variant="ghost" icon="i-heroicons-arrow-left" @click="$emit('back')">{{
                t('config.backBtn') }}</UButton>
            <UButton @click="$emit('next')" trailing-icon="i-heroicons-arrow-right">{{ t('config.nextBtn') }}</UButton>
        </div>
    </div>
</template>
