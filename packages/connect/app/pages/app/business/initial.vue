<!--  Translation file -->
<i18n src="./business.json"></i18n>
<script lang="ts" setup>
import { useBusinessManager } from './composables/useBusinessManager';
import AddBusiness from './components/AddBusiness.vue';
import BusinessCard from './components/BusinessCard.vue';
/**
 *
 * Component Description:Desc
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
const { t } = useI18n()
const router = useRouter();

useHead({
  title: t('seo_title_initial'),
  meta: [
    { name: 'description', content: t('seo_description_initial') }
  ]
});




const { businesses, getAllBusinesses } = useBusinessManager();

getAllBusinesses();

const HandleSelect = (id: string) => {
  router.push(`/app/integrations`)
}
</script>

<template>
  <div>
    <BasePageHeader :title="t('title_initial')" :description="t('description_initial')" />
    <div class="grid grid-cols-5 gap-2 p-2 mt-6">
      <AddBusiness />
      <BusinessCard v-for="business in businesses.data" :key="business.id" :business="business"
        @select="HandleSelect" />
      <div v-if="!businesses.data" class="text-center text-gray-500 grid place-content-center bg-accented rounded">
        {{ t('states.no_businesses') }}
      </div>
    </div>
  </div>
</template>
<style scoped></style>
