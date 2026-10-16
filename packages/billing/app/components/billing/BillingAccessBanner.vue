<i18n src="#site/app/pages/app/billing/index.json"></i18n>
<script setup lang="ts">
import type { AccessState, AccessSummary } from '#layers/BaseBilling/server/utils/entitlement'

/**
 * One line saying who may use the app and why. The verdict comes from the
 * server (`overview.access`); this only presents it. An expired account gets the
 * one action that fixes it — go to the plans.
 */

const props = defineProps<{
  access: AccessSummary | null
}>()

const emit = defineEmits<{ selectPlan: [] }>()

const { t } = useI18n()

const PRESENTATION: Record<AccessState, { color: 'success' | 'warning' | 'error' | 'info', icon: string, key: string }> = {
  admin: { color: 'info', icon: 'i-lucide-shield-check', key: 'access.admin' },
  active: { color: 'success', icon: 'i-lucide-badge-check', key: 'access.active' },
  trialing: { color: 'success', icon: 'i-lucide-badge-check', key: 'access.trialing' },
  trial: { color: 'warning', icon: 'i-lucide-clock', key: 'access.trial' },
  expired: { color: 'error', icon: 'i-lucide-circle-alert', key: 'access.expired' },
}

const view = computed(() => PRESENTATION[props.access?.state ?? 'expired'])

function handleSelectPlan() {
  emit('selectPlan')
}
</script>

<template>
  <UAlert
    v-if="access"
    :color="view.color"
    variant="soft"
    :icon="view.icon"
    :title="t(view.key, { days: access.daysLeft })"
    :description="access.state === 'trial' || access.state === 'trialing' ? t('access.trialHint') : undefined"
    :data-testid="`billing-access-${access.state}`"
  >
    <template v-if="access.state === 'expired'" #description>
      {{ t('access.expiredHint') }}
    </template>
    <template v-if="access.state === 'expired'" #trailing>
      <UButton color="error" variant="solid" size="sm" :label="t('access.choosePlan')" @click="handleSelectPlan" />
    </template>
  </UAlert>
</template>
