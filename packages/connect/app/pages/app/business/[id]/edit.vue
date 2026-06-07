<i18n src="../business.json"></i18n>
<script lang="ts" setup>
import { useBusinessManager } from '../composables/useBusinessManager';
import BusinessFormStep from '../components/BusinessFormStep.vue';
import InviteTeamMember from '../components/InviteTeamMember.vue';
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

const responseResult = ref<InformationSchemaBusinessResponse | null>(null);

const safeParseDetails = (details: unknown): { companyInformation?: string; brandDetails?: Record<string, unknown> } => {
  try {
    if (typeof details === 'string') {
      return JSON.parse(details);
    }
    if (typeof details === 'object' && details !== null) {
      const keys = Object.keys(details);
      if (keys.every(k => /^\d+$/.test(k))) {
        const reconstructed = keys.sort((a, b) => parseInt(a) - parseInt(b)).map(k => (details as Record<string, string>)[k]).join('');
        return JSON.parse(reconstructed);
      }
      return details as { companyInformation?: string; brandDetails?: Record<string, unknown> };
    }
  } catch {
    console.warn('Failed to parse entity details, using base business data only');
  }
  return {};
};

onMounted(async () => {
  try {
    const { data } = await useFetch<{ data: BusinessProfile, entityDetails: EntityDetails }>(`/api/v1/business/${businessId}`);
    console.log(data.value);


    if (data.value?.data) {
      const business = data.value.data;
      const parsedDetails = safeParseDetails(data.value.entityDetails?.details);
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
    console.error('Error loading business:', error);
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
    console.error('Error updating business:', error);
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

useHead({
  title: t('seo_title_edit'),
  meta: [
    { name: 'description', content: t('seo_description_edit') }
  ]
});
</script>

<template>
  <div>
    <BasePageHeader :title="t('title_edit')" :description="t('description_edit')" />

    <div v-if="isLoading" class="flex justify-center py-12">
      <UProgress indicator />
    </div>

    <div v-else-if="responseResult" class="mt-6 space-y-6">
      <BusinessFormStep :result="responseResult" @submit="handleSubmit" @cancel="handleCancel" />

      <UDivider class="my-8" />

      <InviteTeamMember :business-id="businessId" />
    </div>
  </div>
</template>
