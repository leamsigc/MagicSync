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
import type { Account } from '#layers/BaseDB/db/schema';



const listAccounts = useState<Account[] | null>('auth:listAccounts', () => ([]))


onMounted(async () => {
  const { data } = await authClient.listAccounts()

  listAccounts.value = data as unknown as Account[]
})


const { user } = UseUser();

const { t } = useI18n();

useHead({
  title: t('seo_title_all'),
  meta: [
    { name: 'description', content: t('seo_description_all') }
  ]
})
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <BasePageHeader :title="t('title')" :description="t('description')" />
    <div class="grid grid-cols-2  md:grid-cols-5 gap-2">
      <ConnectAddAccount />
      <ConnectIntegrationCard v-for="connection in listAccounts" :name="connection.providerId" :key="connection.id"
        :image="user && user.image ? user.image : ''" :icon="`logos:${connection.providerId}`" :tags="[]"
        :time="connection.createdAt.toLocaleDateString()" connected />
    </div>
  </div>
</template>
<style scoped></style>
