<!--  Translation file -->
<i18n src="./business.json"></i18n>
<script lang="ts" setup>
import { useBusinessManager } from './composables/useBusinessManager';
import AddBusiness from './components/AddBusiness.vue';
import BusinessCard from './components/BusinessCard.vue';
import type { BusinessProfile } from '#layers/BaseDB/db/schema';

const { t } = useI18n()
const router = useRouter();
const toast = useToast();

useHead({
  title: t('seo_title_initial'),
  meta: [
    { name: 'description', content: t('seo_description_initial') }
  ]
});

const { businesses, getAllBusinesses, updateBusiness, deleteBusiness } = useBusinessManager();

await getAllBusinesses();

const showDeleteConfirm = ref(false);
const businessToDelete = ref<string | null>(null);

const handleSelect = (id: string) => {
  router.push(`/app/integrations`)
}

const handleEditBusiness = (id: string) => {
  router.push(`/app/business/${id}/edit`);
}

const confirmDelete = (id: string) => {
  businessToDelete.value = id;
  showDeleteConfirm.value = true;
}

const handleDeleteBusiness = async () => {
  if (!businessToDelete.value) return;

  toast.add({
    title: t('states.deleting'),
    description: t('states.deleting_business'),
    color: 'warning'
  });

  await deleteBusiness(businessToDelete.value);

  showDeleteConfirm.value = false;
  businessToDelete.value = null;

  toast.add({
    title: t('states.deleted'),
    description: t('states.business_deleted'),
    color: 'success'
  });
}

const cancelDelete = () => {
  showDeleteConfirm.value = false;
  businessToDelete.value = null;
}
</script>

<template>
  <div>
    <BasePageHeader :title="t('title_initial')" :description="t('description_initial')" />
    <div class="grid grid-cols-1 md:grid-cols-5 gap-4 p-2 mt-6">
      <AddBusiness initial-setup />
      <BusinessCard v-for="business in businesses.data" :key="business.id" :business="business" @select="handleSelect"
        @edit="(id: string) => router.push(`/app/business/${id}/edit`)" @delete="confirmDelete" />
      <div v-if="!businesses.data || businesses.data.length === 0"
        class=" text-center text-gray-500 grid place-content-center bg-accented rounded-2xl p-8 ">
        {{ t('states.no_businesses') }}
      </div>
    </div>

    <UModal v-model:open="showDeleteConfirm" :close="false">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">{{ t('states.confirm_delete') }}</h3>
          </template>

          <p class="text-gray-600 dark:text-gray-400">
            {{ t('states.confirm_delete_desc') }}
          </p>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton color="neutral" variant="ghost" @click="cancelDelete">
                {{ t('form.cancel') }}
              </UButton>
              <UButton color="error" @click="handleDeleteBusiness">
                {{ t('actions.delete') }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
<style scoped></style>
