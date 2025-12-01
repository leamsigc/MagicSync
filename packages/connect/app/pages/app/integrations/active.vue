<!--  Translation file -->
<i18n src="./active.json"></i18n>

<script lang="ts" setup>
import { useConnectionManager } from './composables/useConnectionManager';

/**
 *
 * The List of all of the active social media platforms
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import dayjs from "dayjs";
import ConnectIntegrationCard from './components/ConnectIntegrationCard.vue';

const { getAllSocialMediaAccounts, pagesList } = useConnectionManager();

onMounted(async () => {
  await getAllSocialMediaAccounts();
})

const { t } = useI18n();
useHead({
  title: t('seo_title_active'),
  meta: [
    { name: 'description', content: t('seo_description_active') }
  ]
})

</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <BasePageHeader :title="t('title')" :description="t('description')" />
    <div class="grid grid-cols-5 gap-2">
      <ConnectIntegrationCard v-for="social in pagesList" :name="social.accountName" :key="social.id"
        :image="social.entityDetail.details.picture ? social.entityDetail.details.picture : ''"
        :icon="`logos:${social.platform}`" :tags="[social.entityDetail.entityType]"
        :time="dayjs(social.createdAt as unknown as string).format('YYYY-MM-DD')" connected :show-pages="false" />
    </div>
  </div>
</template>
<style scoped></style>
