<i18n src="../business.json"></i18n>

<script lang="ts" setup>
import type { FormSubmitEvent } from '@nuxt/ui'
import z from 'zod';

const emit = defineEmits<{
  submit: [payload: FormSubmitEvent<ExtractionForm>]
  skip: []
}>()

const { t } = useI18n()

// Schema and types
const extractionSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
  competitors: z.array(z.string().url('Invalid URL').or(z.literal(''))).optional(),
  channels: z.array(z.string()).optional()
});

type ExtractionForm = z.infer<typeof extractionSchema>;
const extractionState = ref<ExtractionForm>({
  url: '',
  competitors: [''],
  channels: []
});

const availableChannels = ['Reddit', 'X (Twitter)', 'LinkedIn', 'Ads', 'GEO (AI Visibility)', 'SEO', 'Influencer'];

const toggleChannel = (channel: string) => {
  const arr = extractionState.value.channels || [];
  const index = arr.indexOf(channel);
  if (index === -1) {
    extractionState.value.channels = [...arr, channel];
  } else {
    extractionState.value.channels = arr.filter(c => c !== channel);
  }
};

const addCompetitor = () => {
  const currentCompetitors = extractionState.value.competitors || [];
  extractionState.value.competitors = [...currentCompetitors, ''];
};

const removeCompetitor = (index: number) => {
  const currentCompetitors = extractionState.value.competitors || [];
  if (currentCompetitors.length > 0) {
    const newCompetitors = [...currentCompetitors];
    newCompetitors.splice(index, 1);
    extractionState.value.competitors = newCompetitors;
  }
};

const updateCompetitor = (index: number, value: string) => {
  const currentCompetitors = extractionState.value.competitors || [];
  const newCompetitors = [...currentCompetitors];
  newCompetitors[index] = value;
  extractionState.value.competitors = newCompetitors;
};

const handleSubmit = (payload: FormSubmitEvent<ExtractionForm>) => {
  emit('submit', payload)
}

const handleSkip = () => {
  emit('skip')
}
</script>

<template>
  <div
    class="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-lg mx-auto w-full min-h-[500px] grid grid-cols-1 content-center" data-test="step-one">
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
        {{ t('wizard.title') }}
      </h2>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        {{ t('wizard.subtitle_step1') }}
      </p>
    </div>

    <UForm :schema="extractionSchema" :state="extractionState" @submit="handleSubmit" class="space-y-6">
      <!-- Website URL -->
      <UFormField name="url" class="w-full">
        <template #label>
          <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {{ t('wizard.website_url') }}
            <span class="text-red-500">*</span>
          </span>
        </template>
        <UInput v-model="extractionState.url" :placeholder="t('wizard.website_url_desc') || 'yourwebsite.com'" size="lg"
          class="w-full" />
      </UFormField>

      <!-- Competitors -->
      <div class="space-y-3">
        <label class="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {{ t('wizard.competitors') }}
          <span class="text-gray-400 font-normal"> {{ t('wizard.optional') }}</span>
        </label>
        <div v-for="(comp, i) in extractionState.competitors || []" :key="i" class="flex items-center gap-2">
          <UFormField :name="`competitors.${i}`" class="flex-1 mb-0">
            <UInput :model-value="extractionState.competitors?.[i] || ''"
              @update:model-value="updateCompetitor(i, $event)"
              :placeholder="t('wizard.website_url_desc') || 'competitor.com'" size="lg" class="w-full" />
          </UFormField>
          <UButton v-if="(extractionState.competitors?.length || 0) > 1" icon="lucide:x" color="neutral" variant="ghost"
            @click="removeCompetitor(i)" :padded="false"
            class="text-gray-400 hover:text-red-500 mb-0 w-8 h-8 flex justify-center items-center"
            :aria-label="t('wizard.remove_competitor') || 'Remove competitor'" />
        </div>
        <UButton variant="link" icon="lucide:plus" color="neutral" @click="addCompetitor" :padded="false" class="mt-1">
          {{ t('wizard.add_competitor') }}
        </UButton>
      </div>

      <!-- Channels -->
      <div class="space-y-3">
        <label class="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {{ t('wizard.channels') }} <span class="text-gray-400 font-normal">{{ t('wizard.optional') }}</span>
        </label>
        <div class="flex flex-wrap gap-2 my-4">
          <UButton v-for="channel in availableChannels" :key="channel"
            :color="extractionState.channels?.includes(channel) ? 'primary' : 'neutral'"
            :variant="extractionState.channels?.includes(channel) ? 'solid' : 'outline'" @click="toggleChannel(channel)"
            class="transition-all duration-200">
            {{ channel }}
          </UButton>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-col sm:flex-row gap-3 pt-4 mt-6">
        <UButton type="submit" color="primary" size="lg" class="flex-1 justify-center" :disabled="!extractionState.url"
          :loading="false">
          {{ t('wizard.create_project') }}
        </UButton>

        <UButton color="neutral" variant="outline" size="lg" class="flex-1 justify-center" @click="handleSkip">
          {{ t('wizard.skip_extraction') }}
        </UButton>
      </div>
    </UForm>
  </div>
</template>
