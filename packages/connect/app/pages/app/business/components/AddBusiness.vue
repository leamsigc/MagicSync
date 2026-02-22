<i18n src="../business.json"></i18n>
<script lang="ts" setup>
import type { FormSubmitEvent } from '@nuxt/ui'
import z from 'zod';
import { CreateBusinessProfileSchema } from '#layers/BaseDB/db/schema';
import { useBusinessManager } from '../composables/useBusinessManager';
import MultiStepLoader from './MultiStepLoader.vue';
import type { Step } from './MultiStepLoader.vue';

const emit = defineEmits(['add', 'cancel']);
const { t } = useI18n();
const modalOpen = defineModel<boolean>('open');
const { addBusiness, extractBusinessInfo } = useBusinessManager();
const toast = useToast()

const step = ref<1 | 2 | 3>(1);

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
  extractionState.value.competitors = [...(extractionState.value.competitors || []), ''];
};

const removeCompetitor = (index: number) => {
  if (extractionState.value.competitors && extractionState.value.competitors.length > 0) {
    extractionState.value.competitors.splice(index, 1);
  }
};

// Step 2 State
const loaderSteps = ref<Step[]>([
  { text: t('loader.step1_text'), afterText: t('loader.step1_after'), duration: 3000 },
  { text: t('loader.step2_text'), afterText: t('loader.step2_after'), duration: 4000 },
  { text: t('loader.step3_text'), afterText: t('loader.step3_after'), duration: 5000 },
  { text: t('loader.step4_text'), afterText: t('loader.step4_after'), duration: 5000 },
  { text: t('loader.step5_text'), afterText: t('loader.step5_after'), async: true }
]);

const isExtracting = ref(false);

// Step 3 State
const schema = CreateBusinessProfileSchema.omit({ userId: true });
type BusinessForm = z.infer<typeof schema>;

const businessState = ref<Partial<BusinessForm>>({});
const companyInformation = ref('');
const brandDetails = ref('{}');

const selectedTab = ref('business');

const tabs = computed(() => [
  { label: t('tabs.business_details'), value: 'business', slot: 'business' as const },
  { label: t('tabs.company_info'), value: 'company', slot: 'company' as const },
  { label: t('tabs.brand_identity'), value: 'brand', slot: 'brand' as const }
]);

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

    // Populate the step 3 state
    businessState.value = result.businessProfile || {};
    // Fallbacks if AI missed something
    if (!businessState.value.name) businessState.value.name = 'New Business';
    if (!businessState.value.website) businessState.value.website = payload.data.url;

    companyInformation.value = result.companyInformation || '';
    brandDetails.value = typeof result.brandDetails === 'object' ? JSON.stringify(result.brandDetails, null, 2) : (result.brandDetails || '{}');

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

const submitFinalForm = async (payload: FormSubmitEvent<BusinessForm>) => {
  try {
    const validatedData = schema.parse(payload.data);

    // Attempt to parse brand details back to JSON
    let parsedBrandDetails = {};
    try {
      if (brandDetails.value) {
        parsedBrandDetails = JSON.parse(brandDetails.value);
      }
    } catch (e) {
      toast.add({
        title: t('toast.brand_error'),
        description: t('toast.brand_error_desc'),
        color: 'warning'
      });
    }

    const completePayload = {
      ...validatedData,
      entityDetails: {
        channels: extractionState.value.channels?.length ? extractionState.value.channels : [payload.data.website || ''],
        companyInformation: companyInformation.value,
        brandDetails: parsedBrandDetails
      }
    };

    await addBusiness(completePayload);

    // Reset wizard
    step.value = 1;
    extractionState.value = { url: '', competitors: [''], channels: [] };
    businessState.value = {};
    companyInformation.value = '';
    brandDetails.value = '{}';

    modalOpen.value = false;
    toast.add({
      title: t('states.business_added'),
      description: t('states.business_added_successfully'),
      color: 'success'
    })

  } catch (error) {
    console.error('Form submit error:', error);
    toast.add({
      title: t('states.error'),
      description: t('states.something_went_wrong'),
      color: 'error'
    })
  }
};

const skipExtraction = () => {
  businessState.value = {
    name: 'New Business',
    description: '',
    address: '',
    phone: '',
    website: '',
    category: ''
  };
  companyInformation.value = '';
  brandDetails.value = '{}';
  step.value = 3;
};

</script>

<template>
  <UModal fullscreen v-model:open="modalOpen" :ui="{ base: 'overflow-auto' }">
    <!-- Trigger Button -->
    <NButton
      class="flex flex-col items-center justify-center gap-4 w-full h-full min-h-[16rem] rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary-500 hover:bg-gray-50 dark:hover:border-primary-500 dark:hover:bg-gray-800/50 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">
      <div
        class="flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-950/50 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-primary-100 dark:border-primary-900/50">
        <Icon name="lucide:plus" class="w-8 h-8 text-primary-600 dark:text-primary-400" />
      </div>
      <div class="text-center px-4">
        <h3 class="font-semibold text-gray-900 dark:text-white text-lg">{{ t('states.add_business') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('wizard.extract_profile_manually') }}</p>
      </div>
    </NButton>

    <template #content>
      <UCard class="w-full overflow-auto" :ui="{ body: { padding: 'p-0 sm:p-0' }, divide: '' }">
        <div v-if="step !== 1"
          class=" border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 sticky top-0 z-10">
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">{{ t('title') }}</h2>
            <p class="text-sm text-gray-500 mt-1">
              {{ step === 1 ? t('wizard.subtitle_step1') : step === 2 ? t('wizard.subtitle_step2') :
                t('wizard.subtitle_step3') }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton v-if="step === 3" icon="lucide:arrow-left" color="gray" variant="ghost" @click="step = 1"
              title="Back to Extraction" />
            <UButton icon="lucide:x" color="gray" variant="ghost" @click="modalOpen = false" title="Close" />
          </div>
        </div>

        <div :class="step === 1 ? '' : ' bg-gray-50/30 dark:bg-gray-900/30 flex-1 overflow-y-auto'">

          <div v-if="step === 1" class="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-lg mx-auto w-full">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-8 tracking-tight">{{ t('wizard.title') }}
            </h2>

            <UForm :schema="extractionSchema" :state="extractionState" @submit="handleExtractionSubmit"
              class="space-y-6 w-full">

              <UFormField name="url" class="w-full">
                <template #label>
                  <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ t('wizard.website_url') }}
                    <span class="text-red-500">*</span></span>
                </template>
                <UInput v-model="extractionState.url" placeholder="yourwebsite.com" size="lg" class="w-full"
                  :ui="{ rounded: 'rounded-lg' }" />
              </UFormField>

              <div class="space-y-3 pt-2">
                <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {{ t('wizard.competitors') }}
                  <span class="text-slate-400 font-normal">
                    {{ t('wizard.optional') }}
                  </span>
                </label>
                <div v-for="(comp, i) in extractionState.competitors" :key="i" class="flex items-center gap-2">
                  <UFormField :name="`competitors.${i}`" class="flex-1 mb-0">
                    <UInput v-model="extractionState.competitors[i]" placeholder="competitor.com" size="lg"
                      :ui="{ rounded: 'rounded-lg' }" />
                  </UFormField>
                  <UButton v-if="extractionState.competitors && extractionState.competitors.length > 1" color="gray"
                    variant="ghost" icon="lucide:x" @click="removeCompetitor(i)" :padded="false"
                    class="text-slate-400 hover:text-red-500 mb-0 w-8 h-8 flex justify-center items-center" />
                </div>
                <UButton variant="link" icon="lucide:plus" color="gray" @click="addCompetitor" :padded="false"
                  class="mt-1">
                  {{ t('wizard.add_competitor') }}
                </UButton>
              </div>

              <div class="space-y-3 pt-4">
                <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {{ t('wizard.channels') }} <span class="text-slate-400 font-normal">{{ t('wizard.optional') }}</span>
                </label>
                <div class="flex flex-wrap gap-2.5 overflow-scroll py-4">
                  <UCheckboxGroup v-model="extractionState.channels" class="grid grid-cols-4 gap-2"
                    orientation="horizontal" color="primary" variant="card" :items="availableChannels" />
                </div>
              </div>

              <div class="flex gap-4 pt-4 mt-6">
                <UButton type="submit" color="gray" variant="solid" size="xl" class="flex-3 justify-center"
                  :loading="isExtracting" :disabled="!extractionState.url">
                  {{ t('wizard.create_project') }}
                </UButton>

                <UButton color="gray" variant="outline" size="xl" class="flex-2 justify-center"
                  @click="modalOpen = false">
                  {{ t('wizard.cancel') }}
                </UButton>
              </div>
            </UForm>
          </div>

          <div v-else-if="step === 2"
            class="flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
            <div
              class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-full  mx-auto">
              <MultiStepLoader :steps="loaderSteps" :loading="isExtracting" />
            </div>
          </div>

          <div v-else-if="step === 3" class="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <UForm :schema="schema" :state="businessState" @submit="submitFinalForm" class="space-y-6">

              <UTabs :items="tabs" class="w-full" :ui="{ list: 'mb-6 max-w-md mx-auto w-full' }"
                @change="(index) => selectedTab = tabs[index].value">
                <template #business="{ item }">
                  <div class="space-y-5">
                    <UFormField :label="t('form.name') || 'Business Name'" name="name">
                      <UInput v-model="businessState.name" :placeholder="t('placeholders.name') || 'Acme Corp'"
                        size="md" icon="lucide:building-2" />
                    </UFormField>

                    <UFormField :label="t('form.description') || 'Description'" name="description">
                      <UTextarea v-model="businessState.description"
                        :placeholder="t('placeholders.description') || 'Brief description of the business'" :rows="4"
                        autoresize size="md" />
                    </UFormField>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <UFormField :label="t('form.phone') || 'Phone'" name="phone">
                        <UInput v-model="businessState.phone"
                          :placeholder="t('placeholders.phone') || '+1 234 567 8900'" icon="lucide:phone" size="md" />
                      </UFormField>
                      <UFormField :label="t('form.email') || 'Email'" name="email">
                        <UInput v-model="businessState.email" type="email"
                          :placeholder="t('placeholders.email') || 'hello@example.com'" icon="lucide:mail" size="md" />
                      </UFormField>
                    </div>

                    <UFormField :label="t('form.address') || 'Address'" name="address">
                      <UInput v-model="businessState.address"
                        :placeholder="t('placeholders.address') || '123 Main St, City, Country'" icon="lucide:map-pin"
                        size="md" />
                    </UFormField>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <UFormField :label="t('form.website') || 'Website'" name="website">
                        <UInput v-model="businessState.website"
                          :placeholder="t('placeholders.website') || 'https://example.com'" icon="lucide:globe"
                          size="md" />
                      </UFormField>
                      <UFormField :label="t('form.category') || 'Category'" name="category">
                        <UInput v-model="businessState.category"
                          :placeholder="t('placeholders.category') || 'Software, Retail, etc.'" icon="lucide:tag"
                          size="md" />
                      </UFormField>
                    </div>
                  </div>
                </template>




                <template #company="{ item }">
                  <div
                    class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <Icon name="lucide:info" class="w-5 h-5 shrink-0 text-gray-500" />
                    <p>{{ t('company_info.description') }}</p>
                  </div>
                  <UFormField :label="t('company_info.label')" name="companyInformation">
                    <UTextarea v-model="companyInformation" :placeholder="t('company_info.placeholder')" :rows="16"
                      class="font-mono text-xs md:text-sm shadow-inner bg-gray-50 dark:bg-gray-900 rounded-md py-3 px-4"
                      autoresize />
                  </UFormField>
                </template>

                <template #brand="{ item }">
                  <div
                    class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <Icon name="lucide:paint-bucket" class="w-5 h-5 shrink-0 text-gray-500" />
                    <p>{{ t('brand_identity.description') }}</p>
                  </div>
                  <UFormField :label="t('brand_identity.label')" name="brandDetails">
                    <UTextarea v-model="brandDetails" placeholder="{}" :rows="16"
                      class="font-mono text-xs md:text-sm tracking-tight shadow-inner bg-gray-50 dark:bg-gray-900 rounded-md py-3 px-4"
                      autoresize />
                  </UFormField>
                </template>
              </UTabs>

              <div
                class="flex flex-col sm:flex-row justify-end gap-3 pt-6 mt-8 border-t border-gray-200 dark:border-gray-800 -mx-6 -mb-6 px-6 py-4 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm">
                <UButton color="gray" variant="ghost" class="w-full sm:w-auto justify-center"
                  @click="modalOpen = false">{{
                    t('form.cancel') }}
                </UButton>
                <UButton type="submit" color="primary" size="md" icon="lucide:check-circle-2"
                  class="w-full sm:w-auto justify-center shadow-md">{{ t('form.save') }}</UButton>
              </div>
            </UForm>
          </div>

        </div>
      </UCard>
    </template>
  </UModal>
</template>
