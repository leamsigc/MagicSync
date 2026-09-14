<i18n src="../business.json"></i18n>
<script lang="ts" setup>
import { useBusinessManager } from '../composables/useBusinessManager';
import BusinessFormStep from '../components/BusinessFormStep.vue';
import InviteTeamMember from '../components/InviteTeamMember.vue';
import AiModelSettings from '#layers/BaseAuth/app/pages/app/account/components/AiModelSettings.vue';
import BusinessPlaybook from './components/BusinessPlaybook.vue';
import type { BusinessProfile, EntityDetails } from '#layers/BaseDB/db/schema';
import type { InformationSchemaBusinessResponse } from '#layers/BaseScheduler/server/api/v1/ai/information/index.post';
import type { BodySchemaCreateBusinessType } from '#layers/BaseConnect/server/api/v1/business/index.post';

const { t } = useI18n()
const router = useRouter();
const route = useRoute();
const toast = useToast();

const businessId = route.params.id as string;
const { updateBusiness, getAllBusinesses } = useBusinessManager();

const isLoading = ref(true);
const isSaving = ref(false);
const activeTab = ref('details');
const responseResult = ref<InformationSchemaBusinessResponse | null>(null);

const isDetailsShape = (value: unknown): value is { companyInformation?: string; brandDetails?: Record<string, unknown> } => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const safeParseDetails = (details: unknown): { companyInformation?: string; brandDetails?: Record<string, unknown> } => {
  try {
    if (typeof details === 'string') {
      const parsed: unknown = JSON.parse(details)
      return isDetailsShape(parsed) ? parsed : {}
    }
    if (typeof details === 'object' && details !== null) {
      const keys = Object.keys(details);
      if (keys.every(k => /^\d+$/.test(k))) {
        const reconstructed = keys.sort((a, b) => parseInt(a) - parseInt(b)).map(k => (details as Record<string, string>)[k]).join('');
        const reparsed: unknown = JSON.parse(reconstructed)
        return isDetailsShape(reparsed) ? reparsed : {}
      }
      return isDetailsShape(details) ? details : {}
    }
  } catch {
  }
  return {};
};

onMounted(async () => {
  try {
    const data = await $fetch<{ data: BusinessProfile, entityDetails: EntityDetails }>(`/api/v1/business/${businessId}`);


    if (data?.data) {
      const business = data.data;
      const parsedDetails = safeParseDetails(data.entityDetails?.details);
      const brandDetails = safeParseDetails(parsedDetails.brandDetails || {});
      responseResult.value = {
        businessProfile: {
          name: business.name || '',
          description: business.description || '',
          address: business.address || '',
          phone: business.phone || '',
          website: business.website || '',
          category: business.category || ''
        },
        companyInformation: parsedDetails.companyInformation || {},
        brandDetails
      };
    } else {
      toast.add({
        title: t('states.error'),
        description: 'Business not found',
        color: 'error'
      });
      router.push('/app/business');
    }
  } catch (error) {
    toast.add({
      title: t('states.error'),
      description: t('states.something_went_wrong'),
      color: 'error'
    });
    router.push('/app/business');
  } finally {
    isLoading.value = false;
  }
});

const handleSubmit = async (payload: BodySchemaCreateBusinessType) => {
  isSaving.value = true;
  try {
    await updateBusiness(businessId, {
      name: payload.name,
      description: payload.description,
      phone: payload.phone,
      address: payload.address,
      website: payload.website,
      category: payload.category
    });

    toast.add({
      title: t('states.business_updated'),
      description: t('states.business_updated_successfully'),
      color: 'success'
    });

    router.push('/app/business');
  } catch (error: unknown) {
    const errorMessage = extractErrorMessage(error);
    toast.add({
      title: t('states.error'),
      description: errorMessage,
      color: 'error'
    });
  } finally {
    isSaving.value = false;
  }
};

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'data' in error) {
    const err = error as { data?: { errors?: Array<{ field: string; message: string }>; message?: string }; message?: string };
    if (err.data?.errors?.length) {
      return err.data.errors.map(e => `${e.field}: ${e.message}`).join(', ');
    }
    if (err.data?.message) {
      return err.data.message;
    }
    if (err.message) {
      return err.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return t('states.something_went_wrong');
};

const handleCancel = () => {
  router.push('/app/business');
};

function handleSelectTab(tab: string) {
  activeTab.value = tab
}

useHead({
  title: t('seo_title_edit'),
  meta: [
    { name: 'description', content: t('seo_description_edit') }
  ]
});
</script>

<template>
  <div class="min-h-screen ">
    <header class="sticky top-0 z-40 border-b border-white/5  backdrop-blur-xl">
      <div class="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold text-white/90">{{ t('title_edit') }}</h1>
          <p class="text-xs text-white/40">{{ t('description_edit') }}</p>
        </div>
      </div>
    </header>

    <main class=" p-4 lg:mx-auto lg:p-6">
      <div v-if="isLoading" class="flex justify-center py-12">
        <UProgress indicator />
      </div>

      <div v-else-if="responseResult" class="space-y-6">
        <nav class="flex gap-1 rounded-lg bg-white/5 p-1">
          <UButton :color="activeTab === 'details' ? 'primary' : 'neutral'" variant="ghost" size="sm" class="rounded-lg"
            @click="handleSelectTab('details')">
            {{ t('tabs.details') }}
          </UButton>
          <UButton :color="activeTab === 'playbook' ? 'primary' : 'neutral'" variant="ghost" size="sm"
            class="rounded-lg" @click="handleSelectTab('playbook')">
            {{ t('tabs.playbook') }}
          </UButton>
          <UButton :color="activeTab === 'settings' ? 'primary' : 'neutral'" variant="ghost" size="sm"
            class="rounded-lg" @click="handleSelectTab('settings')">
            {{ t('tabs.settings') }}
          </UButton>
        </nav>

        <div v-motion-fade :duration="250">
          <template v-if="activeTab === 'details'">
            <BusinessFormStep :result="responseResult" @submit="handleSubmit" @cancel="handleCancel" />
            <USeparator class="my-8 border-white/5" />
            <InviteTeamMember :business-id="businessId" />
          </template>
          <template v-else-if="activeTab === 'playbook'">
            <BusinessPlaybook :business-id="businessId" />
          </template>
          <template v-else-if="activeTab === 'settings'">
            <UCard class="border border-white/5 bg-[#111111]">
              <template #header>
                <h2 class="font-semibold text-white/70">{{ t('settings.title') }}</h2>
                <p class="text-sm text-white/30">{{ t('settings.description') }}</p>
              </template>
              <AiModelSettings mode="override" :business-id="businessId" />
            </UCard>
          </template>
        </div>
      </div>
    </main>
  </div>
</template>
