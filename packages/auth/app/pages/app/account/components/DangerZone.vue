<!-- Translation file -->
<i18n src="../index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Danger zone for account deletion
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const { t } = useI18n()
const { client } = UseUser()
const toast = useToast()
const router = useRouter()

const loading = ref(false)
const showDialog = ref(false)

const handleDelete = async () => {
  loading.value = true
  try {
    await client.deleteUser({
      callbackURL: '/login' // Redirect to login after deletion
    })

    toast.add({
      title: t('messages.deleteSuccess'),
    })
    showDialog.value = false
  } catch (err: any) {
    toast.add({
      title: t('messages.deleteError'),
      description: err.message,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard class="border-error/50">
    <template #header>
      <h2 class="text-xl font-semibold text-error">{{ t('danger.title') }}</h2>
      <p class="text-sm text-muted-foreground">{{ t('danger.description') }}</p>
    </template>

    <div class="space-y-4">
      <div>
        <h3 class="font-medium mb-2">{{ t('danger.deleteAccount') }}</h3>
        <p class="text-sm text-muted-foreground mb-4">{{ t('danger.deleteDescription') }}</p>
        <UButton color="error" variant="solid" @click="showDialog = true">
          {{ t('danger.deleteButton') }}
        </UButton>
      </div>
    </div>

    <UModal v-model:open="showDialog" :title="t('danger.confirmTitle')" :description="t('danger.confirmDescription')">
      <template #footer>
        <UButton color="neutral" variant="ghost" @click="showDialog = false">{{ t('danger.cancel') }}</UButton>
        <UButton color="error" :loading="loading" @click="handleDelete">
          {{ t('danger.confirm') }}
        </UButton>
      </template>
    </UModal>
  </UCard>
</template>
