<!--  Translation file -->
<i18n src="./connect.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Connection page — providers directory (Grid / List / Table) + pages grid.
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.2
 */
import ConnectIntegrationCard from '#layers/BaseConnect/app/components/connect/integrations/ConnectIntegrationCard.vue';
import ConnectAddAccount from '#layers/BaseConnect/app/components/connect/integrations/ConnectAddAccount.vue';
import ConnectDirectory from '#layers/BaseConnect/app/components/connect/integrations/ConnectDirectory.vue';
import { useConnectionManager } from '#layers/BaseConnect/app/composables/connect/integrations/useConnectionManager';
import { useBusinessManager } from '#layers/BaseShared/app/composables/useBusinessManager';
import { usePlatformIcons, type SocialMediaPlatform } from '#layers/BaseUI/app/composables/usePlatformIcons';
import type { ConnectDirectoryItem, IntegrationHealth } from '#layers/BaseConnect/app/composables/connect/integrations/useIntegrationDirectory';
import { useIntegrationDirectory } from '#layers/BaseConnect/app/composables/connect/integrations/useIntegrationDirectory';
import dayjs from '#layers/BaseDB/server/utils/dayjs';

interface TokenHealth {
  status: 'healthy' | 'expiring_soon' | 'expired' | 'unknown'
  daysRemaining: number | null
}

const connectedAccounts = ref<string[]>([]);
const accountPages = ref<string[]>([]);

const healthSummary = ref({ total: 0, healthy: 0, expiringSoon: 0, expired: 0, unknown: 0, needsAttention: 0 })
const socialHealth = ref<Map<string, TokenHealth>>(new Map())

const { t, getAllSocialMediaAccounts, pagesList, getAllAccountDetails, accountsList } = useConnectionManager();
const { activeBusinessId } = useBusinessManager();
const { getPlatformIcon } = usePlatformIcons();
const { worstHealth } = useIntegrationDirectory();

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

// Connections are business-scoped: reload them on switch, mirroring active.vue.
watch(activeBusinessId, async (newId) => {
  if (!newId) return
  await getAllSocialMediaAccounts(newId)
  await getAllAccountDetails()
  await fetchTokenHealth()
})

const { user } = UseUser();

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
    const pagesId = account.entityDetail?.details?.pages?.map(page => page.id) || [];
    return pagesId;
  }).flat();
}, { immediate: true })

/** Provider health = the worst token status across its linked pages. */
function providerHealth(accountId: string): IntegrationHealth | undefined {
  const healths = pagesList.value
    .filter(page => page.accountId === accountId)
    .map(page => socialHealth.value.get(page.id))
    .filter((health): health is TokenHealth => Boolean(health))
  return worstHealth(healths)
}

const providerConnections = computed<ConnectDirectoryItem[]>(() =>
  accountsList.value.map(account => ({
    id: account.id,
    name: account.providerId,
    icon: getPlatformIcon(account.providerId as SocialMediaPlatform),
    image: user?.image || '',
    connected: true,
    platform: account.providerId,
    accountId: account.id,
    createdAt: account.createdAt,
    tags: [] as string[],
    health: providerHealth(account.id),
  }))
);

const subtitle = computed(() =>
  t('directory.subtitle', { connected: providerConnections.value.length, attention: healthSummary.value.needsAttention })
);
</script>

<template>
  <div class="p-4 lg:mx-auto lg:p-6">
    <BasePageHeader :title="t('title')" :description="subtitle">
      <template #actions>
        <div data-tour="connect-social-media-step-0">
          <ConnectAddAccount variant="button" />
        </div>
      </template>
    </BasePageHeader>

    <h2 class="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
      {{ t('sections.providers') }}
    </h2>
    <div data-tour="connect-social-media-step-1">
      <ConnectDirectory :connections="providerConnections" />
    </div>

    <div v-if="healthSummary.needsAttention > 0"
      class="mt-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
      <UIcon name="lucide:alert-triangle" class="size-5 shrink-0 text-warning" />
      <p class="text-sm text-warning">
        {{ t('directory.attention') }}
        <NuxtLink to="#expired-tokens" class="font-medium underline">{{ t('directory.reconnect_link') }}</NuxtLink>
      </p>
    </div>

    <h2 class="mt-8 mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
      {{ t('sections.pages') }}
    </h2>
    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4" data-tour="connect-social-media-step-2">
      <template v-for="account in accountsList">
        <template v-if="account.entityDetail?.details?.pages">
          <ConnectIntegrationCard v-for="social in account.entityDetail.details.pages" :id="social.id" :key="social.id"
            :name="social.name" :image="social.imageBase64 || ''"
            :icon="getPlatformIcon(account.providerId as SocialMediaPlatform)" :tags="[social.id]"
            :time="dayjs(account.createdAt).format('YYYY-MM-DD')"
            :connected="connectedAccounts.includes(social.id)" :show-pages="false" :show-menu="false"
            :platform="account.providerId" :accountId="social.accountId" />
        </template>
      </template>
      <template v-for="social in pagesList" :key="social.id">
        <ConnectIntegrationCard v-if="!accountPages.includes(social.accountId)" :id="social.id"
          :name="social.accountName"
          :image="social.entityDetail?.details?.picture || ''"
          :icon="getPlatformIcon(social.platform as SocialMediaPlatform)" :tags="[social.accountId]"
          :time="dayjs(social.createdAt).format('YYYY-MM-DD')" connected :show-pages="false"
          :health="socialHealth.get(social.id)" :platform="social.platform" :accountId="social.accountId" />
      </template>
    </div>
  </div>
</template>
<style scoped></style>
