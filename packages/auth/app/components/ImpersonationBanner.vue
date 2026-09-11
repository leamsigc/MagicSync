<i18n src="./ImpersonationBanner.json"></i18n>
<script lang="ts" setup>
import { authClient } from '#layers/BaseAuth/lib/auth-client'
import type { Session } from 'better-auth'

const { t } = useI18n()
const toast = useToast()
const { session, user, fetchSession } = UseUser()

const impersonatedBy = computed(
  () => (session.value as (Session & { impersonatedBy?: string | null }) | null)?.impersonatedBy ?? null
)
const isImpersonating = computed(() => impersonatedBy.value !== null)
const stopping = ref(false)

async function handleStopImpersonating() {
  stopping.value = true
  try {
    await authClient.admin.stopImpersonating()
    clearNuxtData('auth-session')
    await fetchSession()
    toast.add({ title: t('stopped'), description: t('stoppedDescription'), color: 'success' })
    await navigateTo('/app/admin/users')
  } catch {
    toast.add({ title: t('error'), description: t('stopFailed'), color: 'error' })
  } finally {
    stopping.value = false
  }
}
</script>

<template>
  <UBanner v-if="isImpersonating" icon="i-lucide-user-round-search" color="warning">
    <template #title>
      <p class="font-medium">{{ t('viewingAs', { name: user?.name || user?.email }) }}</p>
      <p class="text-xs opacity-80">{{ t('viewingAsHint') }}</p>
    </template>
    <template #actions>
      <UButton size="xs" color="warning" variant="solid" icon="i-lucide-undo-2" :loading="stopping"
        @click="handleStopImpersonating">
        {{ t('backToAccount') }}
      </UButton>
    </template>
  </UBanner>
</template>
