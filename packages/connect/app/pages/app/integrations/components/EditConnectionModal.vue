<i18n src="../connect.json"></i18n>
<script lang="ts" setup>
interface Props {
  connectionId: string
  connectionName: string
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const { t } = useI18n()
const toast = useToast()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

interface ConnectionUser {
  id: string
  name: string
  email: string
  image: string | null
}

interface ConnectionBusiness {
  id: string
  name: string
}

interface ConnectionSettings {
  account: {
    id: string
    userId: string
    businessId: string
    platform: string
    accountName: string
  }
  currentManagers: Array<{ userId: string; user: ConnectionUser | null }>
  availableUsers: ConnectionUser[]
  availableBusinesses: ConnectionBusiness[]
}

const isLoading = ref(false)
const settings = ref<ConnectionSettings | null>(null)
const selectedBusinessId = ref<string | null>(null)
const selectedManagerIds = ref<string[]>([])

const fetchSettings = async () => {
  if (!props.connectionId) return

  isLoading.value = true
  try {
    const data = await $fetch<ConnectionSettings>(`/api/v1/social-accounts/${props.connectionId}`)
    settings.value = data
    selectedBusinessId.value = data.account.businessId
    selectedManagerIds.value = data.currentManagers
      .filter(m => m.user)
      .map(m => m.user!.id)
  } catch (error) {
    console.error('Error fetching connection settings:', error)
    toast.add({
      title: t('messages.error.title'),
      description: 'Failed to load connection settings',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
    isOpen.value = false
  } finally {
    isLoading.value = false
  }
}

const saveSettings = async () => {
  if (!props.connectionId) return

  isLoading.value = true
  try {
    await $fetch(`/api/v1/social-accounts/${props.connectionId}`, {
      method: 'PUT',
      body: {
        businessId: selectedBusinessId.value,
        managerIds: selectedManagerIds.value,
      },
    })

    toast.add({
      title: t('messages.saved.title'),
      description: t('messages.saved.description'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })

    emit('saved')
    isOpen.value = false
  } catch (error) {
    console.error('Error saving connection settings:', error)
    toast.add({
      title: t('messages.error.title'),
      description: 'Failed to save connection settings',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    isLoading.value = false
  }
}

watch(isOpen, (newValue) => {
  if (newValue) {
    fetchSettings()
  }
})
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('modal.edit_connection_title')" :description="t('modal.edit_connection_description')"
    class="md:min-w-2xl" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div v-if="isLoading && !settings" class="flex justify-center p-8">
        <ULoader />
      </div>

      <div v-else-if="settings" class="space-y-6">
        <section>
          <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {{ t('modal.business_section') }}
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UPageCard v-for="business in settings.availableBusinesses" :key="business.id"
              :ui="{ body: 'p-3', root: 'cursor-pointer border-2 transition-colors', wrapper: 'p-0' }"
              :class="[
                selectedBusinessId === business.id
                  ? 'border-primary dark:border-primary'
                  : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
              ]" @click="selectedBusinessId = business.id">
              <section class="flex items-center gap-3">
                <URadio :modelValue="selectedBusinessId" :value="business.id" />
                <div>
                  <p class="font-medium">{{ business.name }}</p>
                </div>
              </section>
            </UPageCard>
          </div>
          <p v-if="settings.availableBusinesses.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('modal.no_businesses') }}
          </p>
        </section>

        <section>
          <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {{ t('modal.managers_section') }}
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UPageCard v-for="user in settings.availableUsers" :key="user.id"
              :ui="{ body: 'p-3', root: 'cursor-pointer border-2 transition-colors', wrapper: 'p-0' }"
              :class="[
                selectedManagerIds.includes(user.id)
                  ? 'border-primary dark:border-primary'
                  : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
              ]" @click="
              selectedManagerIds.includes(user.id)
                ? selectedManagerIds = selectedManagerIds.filter(id => id !== user.id)
                : selectedManagerIds = [...selectedManagerIds, user.id]
              ">
              <section class="flex items-center gap-3">
                <UCheckbox :modelValue="selectedManagerIds" :value="user.id" />
                <UAvatar :src="user.image || undefined" :alt="user.name" size="sm" />
                <div>
                  <p class="font-medium">{{ user.name }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ user.email }}</p>
                </div>
              </section>
            </UPageCard>
          </div>
          <p v-if="settings.availableUsers.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('modal.no_users') }}
          </p>
        </section>
      </div>
    </template>

    <template #footer>
      <UButton variant="soft" color="neutral" @click="isOpen = false">
        {{ t('actions.cancel') }}
      </UButton>
      <UButton :loading="isLoading" color="primary" @click="saveSettings">
        {{ t('actions.save') }}
      </UButton>
    </template>
  </UModal>
</template>