<!--  Translation file -->
<i18n src="./business.json"></i18n>
<script lang="ts" setup>
/**
 *
 * BusinessProfile Management Page
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import BusinessCard from '#layers/BaseConnect/app/components/connect/business/components/BusinessCard.vue';
import AddBusiness from '#layers/BaseConnect/app/components/connect/business/components/AddBusiness.vue';
import DeleteBusinessModal from '#layers/BaseConnect/app/components/connect/business/components/DeleteBusinessModal.vue';
import { useBusinessManager } from '#layers/BaseShared/app/composables/useBusinessManager';
import type { BusinessProfile } from '#layers/BaseDB/db/schema';

const { businesses, getAllBusinesses } = useBusinessManager();
const editingBusiness = ref<BusinessProfile | null>(null);
const businessToDelete = ref<string | null>(null);
const deleteModalOpen = ref(false);
const router = useRouter();

const { data } = await useFetch<PaginatedResponse<BusinessProfile>>('/api/v1/business');

if (data.value) {
  businesses.value = data.value;
} else {
  getAllBusinesses();
}

watch(businesses, (newData) => {
  if (newData.pagination?.total === 0) {
    router.push('/app/business/initial')
  }
});

const handleEditBusiness = (id: string) => {
  editingBusiness.value = businesses.value.data?.find(b => b.id === id) || null;
  router.push(`/app/business/${id}/edit`)
};

const handleDeleteBusiness = (id: string) => {
  if (!id) return
  businessToDelete.value = id;
  deleteModalOpen.value = true;
};

const handleDeleteModalUpdate = (value: boolean) => {
  deleteModalOpen.value = value;
  if (!value) businessToDelete.value = null;
};

const handleBusinessDeleted = () => {
  getAllBusinesses();
};

const { t } = useI18n();

useHead({
  title: t('seo_title_all'),
  meta: [
    { name: 'description', content: t('seo_description_all') }
  ]
});
</script>

<template>
  <div class=" p-4 lg:mx-auto lg:p-6">
    <BasePageHeader :title="t('title')" :description="t('description')" />
    <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
      <div data-tour="create-business-step-0">
        <AddBusiness />
      </div>
      <div v-for="(business, index) in businesses.data" :key="business.id"
        :data-tour="index === 0 ? 'create-business-step-1' : undefined">
        <BusinessCard :business="business" @edit="handleEditBusiness" @delete="handleDeleteBusiness" />
      </div>
      <div v-if="!businesses.data" class="text-center text-gray-500 grid place-content-center bg-accented rounded">
        {{ t('states.no_businesses') }}
      </div>
    </div>

    <DeleteBusinessModal :model-value="deleteModalOpen" :business-id="businessToDelete"
      @update:model-value="handleDeleteModalUpdate" @deleted="handleBusinessDeleted" />
  </div>
</template>
<style scoped></style>
