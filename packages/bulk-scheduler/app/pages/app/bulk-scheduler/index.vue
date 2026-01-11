<!--  Translation file -->
<i18n src="./index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Main bulk scheduler index page
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const { t } = useI18n()
</script>

<template>
  <div class="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
    <div>
      <h1 class="text-2xl md:text-3xl font-bold">{{ t('index.title') }}</h1>
      <p class="text-gray-600 mt-1">{{ t('index.subtitle') }}</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <UCard>
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-primary/10 rounded-lg">
              <Icon name="i-heroicons-document-arrow-up" class="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 class="text-xl font-semibold">{{ t('index.csvImport.title') }}</h2>
              <p class="text-sm text-gray-600">{{ t('index.csvImport.description') }}</p>
            </div>
          </div>

          <ul class="space-y-2 text-sm text-gray-600">
            <li class="flex items-start gap-2">
              <Icon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span>{{ t('index.csvImport.feature1') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <Icon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span>{{ t('index.csvImport.feature2') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <Icon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span>{{ t('index.csvImport.feature3') }}</span>
            </li>
          </ul>

          <UButton to="/app/bulk-scheduler/csv-import" color="primary" block size="lg">
            {{ t('index.csvImport.cta') }}
          </UButton>
        </div>
      </UCard>

      <UCard>
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-blue-500/10 rounded-lg">
              <Icon name="i-heroicons-sparkles" class="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h2 class="text-xl font-semibold">{{ t('index.bulkGenerate.title') }}</h2>
              <p class="text-sm text-gray-600">{{ t('index.bulkGenerate.description') }}</p>
            </div>
          </div>

          <ul class="space-y-2 text-sm text-gray-600">
            <li class="flex items-start gap-2">
              <Icon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span>{{ t('index.bulkGenerate.feature1') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <Icon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span>{{ t('index.bulkGenerate.feature2') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <Icon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span>{{ t('index.bulkGenerate.feature3') }}</span>
            </li>
          </ul>

          <UButton to="/app/bulk-scheduler/generate" color="blue" block size="lg">
            {{ t('index.bulkGenerate.cta') }}
          </UButton>
        </div>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">{{ t('index.howItWorks.title') }}</h3>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="text-center space-y-2">
          <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <span class="text-xl font-bold text-primary">1</span>
          </div>
          <h4 class="font-medium">{{ t('index.howItWorks.step1.title') }}</h4>
          <p class="text-sm text-gray-600">{{ t('index.howItWorks.step1.description') }}</p>
        </div>

        <div class="text-center space-y-2">
          <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <span class="text-xl font-bold text-primary">2</span>
          </div>
          <h4 class="font-medium">{{ t('index.howItWorks.step2.title') }}</h4>
          <p class="text-sm text-gray-600">{{ t('index.howItWorks.step2.description') }}</p>
        </div>

        <div class="text-center space-y-2">
          <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <span class="text-xl font-bold text-primary">3</span>
          </div>
          <h4 class="font-medium">{{ t('index.howItWorks.step3.title') }}</h4>
          <p class="text-sm text-gray-600">{{ t('index.howItWorks.step3.description') }}</p>
        </div>
      </div>
    </UCard>
  </div>
</template>
