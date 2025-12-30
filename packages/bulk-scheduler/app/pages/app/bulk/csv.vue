<script lang="ts" setup>
/**
 * Component Description: Bulk Scheduler - CSV Import PAge
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const { t } = useI18n()
const { getAllSocialMediaAccounts } = useSocialMediaManager()
await getAllSocialMediaAccounts()

// Use the shared composable
const {
    currentStep,
    parsedPosts,
    config,
    selectedAccounts,
    scheduledPosts,
    isScheduling,
    generateSchedule,
    schedulePosts,
    reset
} = useBulkScheduler()

// Reset on mount to ensure fresh state
onMounted(() => {
    reset()
})

const steps = computed(() => [
    { label: t('steps.import'), icon: 'i-heroicons-document-text' },
    { label: t('steps.config'), icon: 'i-heroicons-cog-6-tooth' },
    { label: t('steps.accounts'), icon: 'i-heroicons-users' },
    { label: t('steps.review'), icon: 'i-heroicons-check-circle' }
])

const nextStep = () => {
    currentStep.value++
}

const prevStep = () => {
    if (currentStep.value > 0) currentStep.value--
}
</script>

<template>
    <UContainer class="py-8 max-w-4xl">
        <UCard>
            <template #header>
                <h1 class="text-xl font-bold flex items-center">
                    <UIcon name="i-heroicons-document-text" class="mr-2" />
                    {{ t('title') }} - CSV
                </h1>
            </template>

            <BulkStepper :current-step="currentStep" :steps="steps" />

            <BulkImportCsv v-if="currentStep === 0" v-model:parsedPosts="parsedPosts" @next="nextStep" />

            <BulkConfiguration v-else-if="currentStep === 1" v-model:config="config" @next="nextStep"
                @back="prevStep" />

            <BulkAccountSelection v-else-if="currentStep === 2" v-model:selectedAccounts="selectedAccounts"
                @generate="generateSchedule" @next="nextStep" @back="prevStep" />

            <BulkReview v-else-if="currentStep === 3" :scheduled-posts="scheduledPosts" :is-scheduling="isScheduling"
                :config="config" @schedule="schedulePosts" @back="prevStep" />

        </UCard>
    </UContainer>
</template>
