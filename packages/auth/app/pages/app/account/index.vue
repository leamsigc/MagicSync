<!-- Translation file -->
<i18n src="./index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Account settings page with tabs
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import AccountSettings from './components/AccountSettings.vue'
import LinkedAccounts from './components/LinkedAccounts.vue'
import DangerZone from './components/DangerZone.vue'
import AiModelSettings from './components/AiModelSettings.vue'

const { t } = useI18n()

// Fetch data on mount
onMounted(async () => {
  // These might be redundant if UseUser is used in child components, but keeping for now if they do specific things
  // Actually, fetchAccount and fetchLinkedAccounts in useAccountManagement were wrappers.
  // I deleted useAccountManagement.ts in previous step!
  // So I should remove these calls.
})

// Page meta
useHead({
  title: t('title'),
  meta: [
    { name: 'description', content: t('description') }
  ]
})

function handleAiSaved() {
  return undefined
}

const items = computed(() => [
  {
    label: t('tabs.general'),
    slot: 'general'
  },
  {
    label: t('tabs.linked'),
    slot: 'linked'
  },
  {
    label: t('tabs.ai'),
    slot: 'ai'
  },
  {
    label: t('tabs.danger'),
    slot: 'danger'
  }
])
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">{{ t('heading') }}</h1>
      <p class="text-muted-foreground">{{ t('subheading') }}</p>
    </div>

    <UTabs :items="items" class="w-full" data-tour="account-step-0">
      <template #general>
        <div data-tour="account-step-1">
          <AccountSettings class="mt-6" />
        </div>
      </template>

      <template #linked>
        <LinkedAccounts class="mt-6" />
      </template>

      <template #ai>
        <div v-motion-fade :duration="250">
          <AiModelSettings mode="global" class="mt-6" @saved="handleAiSaved" />
        </div>
      </template>

      <template #danger>
        <div data-tour="account-step-2">
          <DangerZone class="mt-6" />
        </div>
      </template>
    </UTabs>
  </UContainer>
</template>

<style scoped></style>
