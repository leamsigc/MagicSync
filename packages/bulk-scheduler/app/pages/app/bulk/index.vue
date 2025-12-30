<script lang="ts" setup>
/**
 * Component Description: Bulk Scheduler Landing Page
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const { t } = useI18n()
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="mb-8 text-center max-w-2xl mx-auto">
      <h1 class="text-3xl font-bold mb-4">{{ t('title') }}</h1>
      <p class="text-gray-500 dark:text-gray-400">Choose how would you like to create your bulk posts today.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <UCard class="hover:ring-2 ring-primary transition-all cursor-pointer group h-full flex flex-col justify-between"
        @click="navigateTo('/app/bulk/csv')">
        <div class="flex flex-col items-center text-center p-6 space-y-4">
          <div class="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-full group-hover:scale-110 transition-transform">
            <UIcon name="i-heroicons-document-arrow-up" class="w-12 h-12 text-primary" />
          </div>
          <h2 class="text-xl font-bold">{{ t('import.csvTab') }}</h2>
          <p class="text-gray-500 text-sm">Upload a CSV file containing your posts and schedule them in bulk.</p>
        </div>
        <div class="p-6 pt-0 mt-auto w-full">
          <UButton variant="outline" block>Select CSV Import</UButton>
        </div>
      </UCard>

      <UCard class="hover:ring-2 ring-primary transition-all cursor-pointer group h-full flex flex-col justify-between"
        @click="navigateTo('/app/bulk/ai')">
        <div class="flex flex-col items-center text-center p-6 space-y-4">
          <div class="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-full group-hover:scale-110 transition-transform">
            <UIcon name="i-heroicons-sparkles" class="w-12 h-12 text-primary" />
          </div>
          <h2 class="text-xl font-bold">{{ t('import.aiTab') }}</h2>
          <p class="text-gray-500 text-sm">Chat with our AI assistant to generate and schedule multiple posts at once.
          </p>
        </div>
        <div class="p-6 pt-0 mt-auto w-full">
          <UButton variant="outline" block>Select AI Chat</UButton>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
