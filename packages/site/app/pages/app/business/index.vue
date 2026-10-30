<!--  Translation file -->
<i18n src="./business.json"></i18n>
<script lang="ts" setup>
/**
 *
 * BusinessProfile Management Page
 * Directory of businesses with Grid / List / Table views.
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.2
 */
import AddBusiness from '#layers/BaseConnect/app/components/connect/business/components/AddBusiness.vue';
import DeleteBusinessModal from '#layers/BaseConnect/app/components/connect/business/components/DeleteBusinessModal.vue';
import BusinessDirectory from '#layers/BaseConnect/app/components/connect/business/components/BusinessDirectory.vue';
import { useBusinessManager } from '#layers/BaseShared/app/composables/useBusinessManager';
import type { BusinessProfile } from '#layers/BaseDB/db/schema';

const { businesses, getAllBusinesses, activeBusinessId, setActiveBusiness } = useBusinessManager();
const businessToDelete = ref<string | null>(null);
const deleteModalOpen = ref(false);
const addModalOpen = ref(false);
const router = useRouter();
const { t } = useI18n();

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

const businessList = computed(() => businesses.value.data ?? []);
const activeCount = computed(() => businessList.value.filter(business => business.isActive).length);
const subtitle = computed(() =>
  t('directory.subtitle', { active: activeCount.value, total: businessList.value.length })
);

const openAddModal = () => {
  addModalOpen.value = true;
};

const handleEditBusiness = (id: string) => {
  router.push(`/app/business/${id}/content/edit`)
};

const handleSelectBusiness = async (id: string) => {
  await setActiveBusiness(id);
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

useHead({
  title: t('seo_title_all'),
  meta: [
    { name: 'description', content: t('seo_description_all') }
  ]
});
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="subtitle">
    <template #actions>
      <div data-tour="create-business-step-0 ">
        <UButton icon="i-lucide-plus" color="primary" :label="t('actions.new_business')" @click="openAddModal" />
      </div>
    </template>

    <div data-tour="create-business-step-1">
      <BusinessDirectory :businesses="businessList" :active-business-id="activeBusinessId" @edit="handleEditBusiness"
        @delete="handleDeleteBusiness" @select="handleSelectBusiness" />
    </div>

    <!-- The create wizard keeps its own modal; the header button triggers it. -->
    <div class="hidden">
      <AddBusiness v-model:open="addModalOpen" />
    </div>

    <DeleteBusinessModal :model-value="deleteModalOpen" :business-id="businessToDelete"
      @update:model-value="handleDeleteModalUpdate" @deleted="handleBusinessDeleted" />
  </BaseCollectionPage>
</template>
<style scoped></style>
