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
import BusinessCard from './components/BusinessCard.vue';
import AddBusiness from './components/AddBusiness.vue';
import { useBusinessManager } from './composables/useBusinessManager';
import type { BusinessProfile } from '#layers/BaseDB/db/schema';

const { businesses, getAllBusinesses, updateBusiness, deleteBusiness } = useBusinessManager();
const editingBusiness = ref<BusinessProfile | null>(null);
const router = useRouter();
const toast = useToast();

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
};

const handleDeleteBusiness = async (id: string) => {
  if (!id) return
  toast.add({
    title: 'Deleting Business',
    description: 'Please wait...'
  });
  await deleteBusiness(id);

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
  <div class="container mx-auto py-6 space-y-6">
    <BasePageHeader :title="t('title')" :description="t('description')" />
    <div class="grid grid-cols-5 gap-2">
      <AddBusiness />
      <BusinessCard v-for="business in businesses.data" :key="business.id" :business="business"
        @edit="handleEditBusiness" @delete="handleDeleteBusiness" />
      <div v-if="!businesses.data" class="text-center text-gray-500 grid place-content-center bg-accented rounded">
        {{ t('states.no_businesses') }}
      </div>
    </div>


  </div>
</template>
<style scoped></style>
