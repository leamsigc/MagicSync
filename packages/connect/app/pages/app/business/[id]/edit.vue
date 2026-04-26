<i18n src="../business.json"></i18n>
<script lang="ts" setup>
import { useBusinessManager } from '../composables/useBusinessManager';
import BusinessFormStep from '../components/BusinessFormStep.vue';
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

onMounted(async () => {
  try {
    const { data } = await useFetch<{ data: BusinessProfile, entityDetails: EntityDetails }>(`/api/v1/business/${businessId}`);
    console.log(data.value);


    if (data.value?.data) {
      const business = data.value.data;
      const details = JSON.parse(data.value.entityDetails.details || {});
      responseResult.value = {
        businessProfile: {
          name: business.name || '',
          description: business.description || '',
          address: business.address || '',
          phone: business.phone || '',
          website: business.website || '',
          category: business.category || ''
        },
        companyInformation: details.companyInformation,
        brandDetails: JSON.parse(details.brandDetails || {})
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
  } catch (error) {
    console.error('Error updating business:', error);
    toast.add({
      title: t('states.error'),
      description: t('states.something_went_wrong'),
      color: 'error'
    });
  } finally {
    isSaving.value = false;
  }
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

    <div v-else-if="responseResult" class="mt-6">
      <BusinessFormStep :result="responseResult" @submit="handleSubmit" @cancel="handleCancel" />
    </div>
  </div>
</template>
