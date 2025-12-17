<!--  Translation file -->
<i18n src="./connect.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Connection page
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import ConnectIntegrationCard from './components/ConnectIntegrationCard.vue';
import ConnectAddAccount from './components/ConnectAddAccount.vue';
import { useConnectionManager } from './composables/useConnectionManager';
import { authClient } from '#layers/BaseAuth/lib/auth-client';
import { entityDetails, type Account } from '#layers/BaseDB/db/schema';
import dayjs from '#layers/BaseDB/server/utils/dayjs';



const connectedAccounts = ref<string[]>([]);
const accountPages = ref<string[]>([]);

const { getAllSocialMediaAccounts, pagesList, getAllAccountDetails, accountsList } = useConnectionManager();
onMounted(async () => {
  await getAllAccountDetails();
  await getAllSocialMediaAccounts();
})


const { user } = UseUser();

const { t } = useI18n();

useHead({
  title: t('seo_title_all'),
  meta: [
    { name: 'description', content: t('seo_description_all') }
  ]
})
watch(pagesList, () => {
  connectedAccounts.value = pagesList.value.map(account => account.accountId);
}, { immediate: true })
watch(accountsList, () => {
  accountPages.value = accountsList.value.map(account => {
    const pagesId = account.entityDetail?.details.pages.map(page => page.id) || [];
    return pagesId;
  }).flat();
}, { immediate: true })

</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <BasePageHeader :title="t('title')" :description="t('description')" />
    <h3>Providers</h3>
    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
      <ConnectAddAccount />
      <ConnectIntegrationCard v-for="connection in accountsList" :name="connection.providerId" :key="connection.id"
        :image="user && user.image ? user.image : ''" :icon="`logos:${connection.providerId}`" :tags="[]"
        :time="dayjs(connection.createdAt as unknown as string).format('YYYY-MM-DD')" connected />
    </div>
    <h3>Pages</h3>
    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
      <template v-for="account in accountsList">
        <template v-if="account.entityDetail && account.entityDetail.details.pages">
          <ConnectIntegrationCard v-for="social in account.entityDetail.details.pages" :name="social.name"
            :key="social.id" :image="social.imageBase64 || ''" :icon="`logos:${account.providerId}`" :tags="[social.id]"
            :time="dayjs(account.createdAt as unknown as string).format('YYYY-MM-DD')"
            :connected="connectedAccounts.includes(social.id)" :show-pages="false" :show-menu="false" />
        </template>
      </template>
      <template v-for="social in pagesList" :key="social.id">
        <ConnectIntegrationCard :name="social.accountName" v-if="!accountPages.includes(social.accountId)"
          :image="social.entityDetail.details.picture ? social.entityDetail.details.picture : ''"
          :icon="`logos:${social.platform}`" :tags="[social.accountId]"
          :time="dayjs(social.createdAt as unknown as string).format('YYYY-MM-DD')" connected :show-pages="false" />
      </template>
    </div>
  </div>
</template>
<style scoped></style>
