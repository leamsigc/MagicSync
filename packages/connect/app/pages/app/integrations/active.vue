<!--  Translation file -->
<i18n src="./active.json"></i18n>

<script lang="ts" setup>
import { useConnectionManager } from './composables/useConnectionManager'
import { useBusinessManager } from '../business/composables/useBusinessManager'
import { usePlatformIcons, type SocialMediaPlatform } from '#layers/BaseUI/app/composables/usePlatformIcons'
import dayjs from "dayjs"
import ConnectIntegrationCard from './components/ConnectIntegrationCard.vue'

interface TokenHealth {
  status: 'healthy' | 'expiring_soon' | 'expired' | 'unknown'
  daysRemaining: number | null
}

const { t, getAllSocialMediaAccounts, pagesList, getTokenHealth } = useConnectionManager()
const { activeBusinessId, getAllBusinesses } = useBusinessManager()
const { getPlatformIcon } = usePlatformIcons()

const healthMap = ref<Map<string, TokenHealth>>(new Map())

onMounted(async () => {
  await getAllBusinesses()
  await getAllSocialMediaAccounts(activeBusinessId.value)
  const healthData = await getTokenHealth(activeBusinessId.value)
  if (healthData?.accounts) {
    const m = new Map<string, TokenHealth>()
    for (const acc of healthData.accounts) {
      m.set(acc.id, acc.health)
    }
    healthMap.value = m
  }
})

const filteredAccounts = computed(() => {
  if (!activeBusinessId.value) return []
  return pagesList.value.filter(account => account.businessId === activeBusinessId.value)
})

watch(activeBusinessId, async (newId) => {
  if (newId) {
    await getAllSocialMediaAccounts(newId)
    const healthData = await getTokenHealth(newId)
    if (healthData?.accounts) {
      const m = new Map<string, TokenHealth>()
      for (const acc of healthData.accounts) {
        m.set(acc.id, acc.health)
      }
      healthMap.value = m
    }
  }
})

useHead({
  title: t('seo_title_active'),
  meta: [
    { name: 'description', content: t('seo_description_active') }
  ]
})

</script>

<template>
  <div class=" p-4 lg:mx-auto lg:p-6">
    <BasePageHeader :title="t('title')" :description="t('description')" />
    <div v-if="healthMap.size > 0"
      class="flex flex-wrap gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
      <UIcon name="lucide:alert-triangle" class="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
      <p class="text-sm text-yellow-800 dark:text-yellow-200">
        Some connections have token issues — check the cards below to
        <NuxtLink to="/app/integrations" class="underline font-medium">reconnect now</NuxtLink>.
      </p>
    </div>
    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
      <ConnectIntegrationCard v-for="social in filteredAccounts" :name="social.accountName" :key="social.id"
        :image="social.entityDetail?.details?.picture ? social.entityDetail.details.picture : ''"
        :icon="social.platform ? getPlatformIcon(social.platform as SocialMediaPlatform) : ''"
        :tags="[social.accountId]" :id="social.id"
        :time="dayjs(social.createdAt as unknown as string).format('YYYY-MM-DD')" connected :show-pages="false"
        :health="healthMap.get(social.id)" :platform="social.platform" :accountId="social.accountId" />
    </div>
  </div>
</template>
<style scoped></style>
