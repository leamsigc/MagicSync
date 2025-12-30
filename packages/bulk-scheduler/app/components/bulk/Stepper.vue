<script setup lang="ts">
/**
 * Component Description: Visual stepper for bulk scheduler
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const props = defineProps<{
    currentStep: number
    steps: { label: string, icon: string }[]
}>()
</script>

<template>
    <div class="mb-8 flex justify-between items-center">
        <div v-for="(step, index) in steps" :key="index" class="flex items-center">
            <div class="flex items-center"
                :class="{ 'text-primary': currentStep >= index, 'text-gray-400': currentStep < index }">
                <UIcon :name="step.icon" class="w-5 h-5 mr-2" />
                <span class="font-medium hidden md:inline">{{ step.label }}</span>
            </div>
            <div v-if="index < steps.length - 1" class="mx-4 h-0.5 w-12 bg-gray-200 hidden md:block"
                :class="{ 'bg-primary': currentStep > index }"></div>
        </div>
    </div>
</template>
