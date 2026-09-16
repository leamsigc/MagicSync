<!--  Translation file -->
<i18n src="../pages/app/business/business.json"></i18n>
<script lang="ts" setup>
import { useBusinessManager } from '../pages/app/business/composables/useBusinessManager';
import AddBusiness from '../pages/app/business/components/AddBusiness.vue';
import BusinessCard from '../pages/app/business/components/BusinessCard.vue';
import DeleteBusinessModal from '../pages/app/business/components/DeleteBusinessModal.vue';

const { t } = useI18n()
const router = useRouter();

const { businesses, getAllBusinesses } = useBusinessManager();

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

const handleDeleteModalUpdate = (value: boolean) => {
  showDeleteConfirm.value = value;
  if (!value) businessToDelete.value = null;
}

const handleBusinessDeleted = () => {
  getAllBusinesses();
}
</script>

<template>
  <div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-2 mt-6">
      <AddBusiness initial-setup />
      <BusinessCard v-for="business in businesses.data" :key="business.id" :business="business" @select="handleSelect"
        @edit="handleEditBusiness" @delete="confirmDelete" />
      <div v-if="!businesses.data || businesses.data.length === 0"
        class=" text-center text-gray-500 grid place-content-center bg-accented rounded-2xl p-8 ">
        {{ t('states.no_businesses') }}
      </div>
    </div>

    <DeleteBusinessModal :model-value="showDeleteConfirm" :business-id="businessToDelete"
      @update:model-value="handleDeleteModalUpdate" @deleted="handleBusinessDeleted" />
  </div>
</template>
<style scoped></style>
