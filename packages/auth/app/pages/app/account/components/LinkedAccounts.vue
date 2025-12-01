<!-- Translation file -->
<i18n src="../index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Linked accounts management
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const { t } = useI18n()
const { client, getUserAccountList, listAccounts } = UseUser()
const toast = useToast()

const loading = ref(false)

onMounted(async () => {
  await getUserAccountList()
})

const handleUnlink = async (accountId: string) => {
  loading.value = true
  try {
    await $fetch('/api/v1/account/unlink', {
      method: 'POST',
      body: { accountId }
    })

    await getUserAccountList()

    toast.add({
      title: t('messages.unlinkSuccess'),
    })
  } catch (err: any) {
    toast.add({
      title: t('messages.unlinkError'),
      description: err.message,
      color: "error"
    })
  } finally {
    loading.value = false
  }
}

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString()
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-xl font-semibold">{{ t('linked.title') }}</h2>
      <p class="text-sm text-muted-foreground">{{ t('linked.description') }}</p>
    </template>

    <div v-if="!listAccounts || listAccounts.length === 0" class="text-center py-8 text-muted-foreground">
      {{ t('linked.noAccounts') }}
    </div>

    <div v-else class="space-y-4">
      <div v-for="acc in listAccounts" :key="acc.id" class="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <p class="font-medium capitalize">{{ acc.providerId }}</p>
          <p class="text-sm text-muted-foreground">
            {{ t('linked.connectedAt') }}: {{ formatDate(acc.createdAt) }}
          </p>
        </div>
        <UButton variant="outline" size="sm" :loading="loading" @click="handleUnlink(acc.id)">
          {{ t('linked.unlink') }}
        </UButton>
      </div>
    </div>
  </UCard>
</template>
