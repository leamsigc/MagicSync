<i18n src="../business.json"></i18n>
<script lang="ts" setup>
import type { FormSubmitEvent } from '@nuxt/ui'
import z from 'zod'
import { useBusinessManager } from '../composables/useBusinessManager'
import StepZero from './StepZero.vue'
import BusinessExtractionStep from './BusinessExtractionStep.vue'
import BusinessFormStep from './BusinessFormStep.vue'
import BusinessLoadingStep from './BusinessLoadingStep.vue'
import type { InformationSchemaBusinessResponse } from '#layers/BaseScheduler/server/api/v1/ai/information/index.post'
import type { BodySchemaCreateBusinessType } from '#layers/BaseConnect/server/api/v1/business/index.post'

const emit = defineEmits(['add', 'cancel'])
const { t } = useI18n()
const modalOpen = defineModel<boolean>('open')
const initialSetup = defineModel<boolean>('initialSetup', { default: false })
const { addBusiness, extractBusinessInfo, setActiveBusiness } = useBusinessManager()
const toast = useToast()
const router = useRouter()

const step = ref<0 | 1 | 2 | 3>(0)

// Step 1 State
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

// Step 2 State
const loaderSteps = ref([
  { text: t('loader.step1_text'), afterText: t('loader.step1_after'), duration: 3000 },
  { text: t('loader.step2_text'), afterText: t('loader.step2_after'), duration: 4000 },
  { text: t('loader.step3_text'), afterText: t('loader.step3_after'), duration: 5000 },
  { text: t('loader.step4_text'), afterText: t('loader.step4_after'), duration: 5000 },
  { text: t('loader.step5_text'), afterText: t('loader.step5_after'), async: true }
]);

const isExtracting = ref(false);

// Step 3 State
const responseResult = ref<InformationSchemaBusinessResponse>();

const handleExtractionSubmit = async (payload: FormSubmitEvent<ExtractionForm>) => {
  step.value = 2;
  isExtracting.value = true;

  try {
    const defaultExplanation = 'Extract comprehensive business profile, core offering, top competitors, target audience, and infer brand design details (colors, typography).';
    const validCompetitors = payload.data.competitors?.filter(c => c && c.trim() !== '') || [];

    const result = await extractBusinessInfo({
      url: payload.data.url,
      explanation: defaultExplanation,
      competitors: validCompetitors.length > 0 ? validCompetitors : undefined
    });

    responseResult.value = result;
    isExtracting.value = false;
    step.value = 3;

  } catch (error) {
    console.error('Extraction failed:', error);
    toast.add({
      title: t('toast.extraction_failed'),
      description: t('toast.extraction_failed_desc'),
      color: 'error'
    });
    isExtracting.value = false;
    step.value = 1;
  }
};

const submitFinalForm = async (payload: BodySchemaCreateBusinessType) => {
  try {
    const response = await addBusiness(payload);
    
    if (!response) {
      throw new Error('No response from server');
    }
    
    if (!response.id) {
      console.error('Invalid response:', response);
      throw new Error('Failed to create business - invalid response');
    }

    await setActiveBusiness(response.id);

    step.value = 1;
    extractionState.value = { url: '', competitors: [''], channels: [] };
    responseResult.value = undefined;

    modalOpen.value = false;
    toast.add({
      title: t('states.business_added'),
      description: t('states.business_added_successfully'),
      color: 'success'
    })

    if (initialSetup.value) {
      router.push('/app/integrations');
    }

  } catch (error: any) {
    console.error('Form submit error:', error);
    toast.add({
      title: t('states.error'),
      description: error?.message || t('states.something_went_wrong'),
      color: 'error'
    })
  }
};

const skipExtraction = () => {
  responseResult.value = {
    brandDetails: {
      colorScheme: '{}',
      colors: {},
    },
    companyInformation: "",
    businessProfile: {
      address: "",
      category: "",
      description: "",
      name: "",
      phone: "",
      website: ""
    },
  };
  step.value = 3;
};

const handleStepZeroContinue = () => {
  step.value = 1;
};

const handleStepZeroSkip = () => {
  step.value = 1;
};

const handleCancel = () => {
  modalOpen.value = false;
  step.value = 0;
};
</script>

<template>
  <UModal v-model:open="modalOpen" @close="handleCancel" :dismissible="false"
    :ui="{ content: 'min-w-5xl overflow-y-auto' }">
    <!-- Trigger Button -->
    <UButton variant="ghost"
      class="flex flex-col items-center justify-center gap-4 w-full h-full min-h-[16rem] rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary-500 hover:bg-gray-50 dark:hover:border-primary-500 dark:hover:bg-gray-800/50 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">
      <div
        class="flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-950/50 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-primary-100 dark:border-primary-900/50">
        <Icon name="lucide:plus" class="w-8 h-8 text-primary-600 dark:text-primary-400" />
      </div>
      <div class="text-center px-4">
        <h3 class="font-semibold text-gray-900 dark:text-white text-lg">{{ t('states.add_business') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('wizard.extract_profile_manually') }}</p>
      </div>
    </UButton>

    <template #content>
      <UCard class="w-full h-full min-w-5xl overflow-auto">
        <div class="flex items-center justify-end  sticky top-0 z-10">
          <div class="flex items-center gap-2">
            <UButton icon="lucide:x" color="neutral" variant="ghost" @click="handleCancel" title="Close" />
          </div>
        </div>

        <div :class="step === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-900/30 flex-1'">
          <!-- Step 0: Initial Setup -->
          <StepZero v-if="step === 0" @continue="handleStepZeroContinue" @skip="handleStepZeroSkip" />

          <!-- Step 1: Business Extraction -->
          <BusinessExtractionStep v-else-if="step === 1" @submit="handleExtractionSubmit" @skip="skipExtraction" />

          <!-- Step 2: Loading/Processing -->
          <BusinessLoadingStep v-else-if="step === 2" :steps="loaderSteps" :loading="isExtracting" :visible="true"
            @update:visible="() => { isExtracting = false; step = 1 }"
            @close="() => { isExtracting = false; step = 1 }" />

          <!-- Step 3: Business Form -->
          <BusinessFormStep v-else-if="step === 3 && responseResult" :result="responseResult" @submit="submitFinalForm"
            @cancel="handleCancel" />
        </div>
      </UCard>
    </template>
  </UModal>
</template>
