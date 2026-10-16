<i18n src="../../business.json"></i18n>
<script lang="ts" setup>
import { useBusinessManager } from '#layers/BaseShared/app/composables/useBusinessManager';
import { coerceJsonObject } from '#layers/BaseShared/utils/json';
import BusinessFormStep from '#layers/BaseConnect/app/components/connect/business/components/BusinessFormStep.vue';
import BusinessWorkspaceTabs from '#layers/BaseConnect/app/components/connect/business/components/BusinessWorkspaceTabs.vue';
import InviteTeamMember from '#layers/BaseConnect/app/components/connect/business/components/InviteTeamMember.vue';
import AiModelSettings from '#layers/BaseAuth/app/components/auth/account/components/AiModelSettings';
import type { BusinessProfile, EntityDetails } from '#layers/BaseDB/db/schema';
import type { InformationSchemaBusinessResponse } from '#layers/BaseShared/server/types/information-schema';
import type { BodySchemaCreateBusinessType } from '#layers/BaseConnect/server/api/v1/business/index.post.ts';

const { t } = useI18n()
const router = useRouter();
const route = useRoute();
const toast = useToast();

const businessId = route.params.id as string;
const { updateBusiness } = useBusinessManager();

const isLoading = ref(true);
const isSaving = ref(false);
const responseResult = ref<InformationSchemaBusinessResponse | null>(null);
const preservedDetails = ref<Record<string, unknown>>({});
const safeMode = ref(true);
const safeModeLoading = ref(false);

/** Brand details are edited as JSON text; store them back as an object. */
const toBrandObject = (value: unknown): Record<string, unknown> => coerceJsonObject(value);

onMounted(async () => {
  void loadSafeMode();
  try {
    const data = await $fetch<{ data: BusinessProfile, entityDetails: EntityDetails }>(`/api/v1/business/${businessId}`);

    if (data?.data) {
      const business = data.data;
      const details = coerceJsonObject(data.entityDetails?.details);
      preservedDetails.value = details;
      const companyInformation = typeof details.companyInformation === 'string' ? details.companyInformation : '';
      responseResult.value = {
        businessProfile: {
          name: business.name || '',
          description: business.description || '',
          address: business.address || '',
          phone: business.phone || '',
          website: business.website || '',
          category: business.category || ''
        },
        companyInformation,
        brandDetails: toBrandObject(details.brandDetails)
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
    const entityDetails = {
      ...preservedDetails.value,
      companyInformation: payload.entityDetails?.companyInformation ?? '',
      brandDetails: toBrandObject(payload.entityDetails?.brandDetails),
      channels: preservedDetails.value.channels ?? [],
    };

    await updateBusiness(businessId, {
      name: payload.name,
      description: payload.description,
      phone: payload.phone,
      address: payload.address,
      website: payload.website,
      category: payload.category
    }, entityDetails);

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

async function loadSafeMode() {
  try {
    const response = await $fetch<{ safeMode: boolean }>(`/api/v1/business/${businessId}/safe-mode`);
    safeMode.value = response.safeMode;
  }
  catch {
    safeMode.value = true;
  }
}

async function handleToggleSafeMode(value: boolean) {
  safeModeLoading.value = true;
  try {
    await $fetch(`/api/v1/business/${businessId}/safe-mode`, {
      method: 'PUT',
      body: { safeMode: value }
    });
    safeMode.value = value;
    toast.add({ title: t('safe_mode.saved'), color: 'success' });
  }
  catch {
    safeMode.value = !value;
    toast.add({ title: t('states.something_went_wrong'), color: 'error' });
  }
  finally {
    safeModeLoading.value = false;
  }
}

useHead({
  title: t('seo_title_edit'),
  meta: [
    { name: 'description', content: t('seo_description_edit') }
  ]
});
</script>

<template>
  <div class="mx-auto w-full max-w-[100rem] px-4 py-4 lg:px-8">
    <BusinessWorkspaceTabs :business-id="businessId" active="edit" />

    <div v-if="isLoading" class="flex justify-center py-12">
      <UProgress indicator />
    </div>

    <div v-else-if="responseResult" class="space-y-6">
      <BusinessFormStep :result="responseResult" @submit="handleSubmit" @cancel="handleCancel" />
      <USeparator class="my-8" />
      <InviteTeamMember :business-id="businessId" />
      <UCard class="border border-default">
        <template #header>
          <h2 class="font-semibold text-highlighted">{{ t('safe_mode.section') }}</h2>
          <p class="text-sm text-muted">{{ t('safe_mode.sectionDescription') }}</p>
        </template>
        <div class="flex items-center justify-between gap-4 py-2" data-testid="safe-mode-toggle">
          <div>
            <p class="text-sm font-medium text-highlighted">{{ t('safe_mode.label') }}</p>
            <p class="text-xs text-muted">{{ t('safe_mode.description') }}</p>
          </div>
          <USwitch :model-value="safeMode" :loading="safeModeLoading" @update:model-value="handleToggleSafeMode" />
        </div>
      </UCard>
      <UCard class="border border-default">
        <template #header>
          <h2 class="font-semibold text-highlighted">{{ t('settings.title') }}</h2>
          <p class="text-sm text-muted">{{ t('settings.description') }}</p>
        </template>
        <AiModelSettings mode="override" :business-id="businessId" />
      </UCard>
    </div>
  </div>
</template>
