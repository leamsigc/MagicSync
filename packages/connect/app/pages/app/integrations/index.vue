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
import dayjs from '#layers/BaseDB/server/utils/dayjs';

interface TokenHealth {
  status: 'healthy' | 'expiring_soon' | 'expired' | 'unknown'
  daysRemaining: number | null
}

const connectedAccounts = ref<string[]>([]);
const accountPages = ref<string[]>([]);

const healthSummary = ref({ total: 0, healthy: 0, expiringSoon: 0, expired: 0, unknown: 0, needsAttention: 0 })
const accountHealth = ref<Map<string, TokenHealth>>(new Map())
const socialHealth = ref<Map<string, TokenHealth>>(new Map())

const { getAllSocialMediaAccounts, pagesList, getAllAccountDetails, accountsList } = useConnectionManager();

async function fetchTokenHealth() {
  try {
    const data = await $fetch<{ accounts: Array<{ id: string; health: TokenHealth }>; summary: typeof healthSummary.value }>('/api/v1/social-accounts/health')
    const sMap = new Map<string, TokenHealth>()
    for (const acc of data.accounts) {
      sMap.set(acc.id, acc.health)
    }
    socialHealth.value = sMap
    healthSummary.value = data.summary
  } catch {
    // health check is non-critical
  }
}

onMounted(async () => {
  await Promise.all([
    getAllAccountDetails(),
    getAllSocialMediaAccounts(),
    fetchTokenHealth()
  ])
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
        :id="connection.id" :time="dayjs(connection.createdAt as unknown as string).format('YYYY-MM-DD')" connected
        :health="accountHealth.get(connection.id)" />
    </div>
    <div v-if="healthSummary.needsAttention > 0" class="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
      <UIcon name="lucide:alert-triangle" class="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
      <p class="text-sm text-yellow-800 dark:text-yellow-200">
        {{ healthSummary.needsAttention }} connection{{ healthSummary.needsAttention === 1 ? '' : 's' }} need{{ healthSummary.needsAttention === 1 ? 's' : '' }} attention —
        <NuxtLink to="#expired-tokens" class="underline font-medium">reconnect expired tokens</NuxtLink> to avoid publish failures.
      </p>
    </div>
    <h3>Pages</h3>
    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
      <template v-for="account in accountsList">
        <template v-if="account.entityDetail && account.entityDetail.details.pages">
          <ConnectIntegrationCard v-for="social in account.entityDetail.details.pages" :name="social.name"
            :key="social.id" :image="social.imageBase64 || ''" :icon="`logos:${account.providerId}`" :tags="[social.id]"
            :time="dayjs(account.createdAt as unknown as string).format('YYYY-MM-DD')" :id="social.id"
            :connected="connectedAccounts.includes(social.id)" :show-pages="false" :show-menu="false" />
        </template>
      </template>
      <template v-for="social in pagesList" :key="social.id">
        <ConnectIntegrationCard :name="social.accountName" v-if="!accountPages.includes(social.accountId)"
          :image="social.entityDetail.details.picture ? social.entityDetail.details.picture : ''" :id="social.id"
          :icon="`logos:${social.platform}`" :tags="[social.accountId]"
          :time="dayjs(social.createdAt as unknown as string).format('YYYY-MM-DD')" connected :show-pages="false"
          :health="socialHealth.get(social.id)" />
      </template>
    </div>
  </div>
</template>
<style scoped></style>
