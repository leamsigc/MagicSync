<i18n src="./index.json"></i18n>

<script lang="ts" setup>

const { t } = useI18n()
const activeBusinessId = useState<string>('business:id');
const toast = useToast();
const {
  apiKeys,
  loading,
  error,
  newApiKey,
  showKeyModal,
  fetchApiKeys,
  createApiKey,
  deleteApiKey,
  closeKeyModal,
  copyToClipboard
} = useApiKeyManagement()

const showCreateModal = ref(false)
const newKeyName = ref('')
const newKeyExpires = ref(90)
const creating = ref(false)
const deleteLoading = ref<string | null>(null)
const copied = ref(false)

const expirationOptions = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
  { label: '6 months', value: 180 },
  { label: '1 year', value: 365 },
  { label: 'Never', value: 0 }
]

watch(activeBusinessId, (newVal) => {
  if (newVal) {
    fetchApiKeys(newVal)
  }
}, { immediate: true })

onMounted(() => {
  if (activeBusinessId.value) {
    fetchApiKeys(activeBusinessId.value)
  }
})

const handleCreate = async () => {
  if (!newKeyName.value.trim()) {
    toast.add({ title: 'Please enter a key name', color: 'error' })
    return
  }

  creating.value = true
  try {
    await createApiKey(newKeyName.value, activeBusinessId.value, newKeyExpires.value || undefined)
    showCreateModal.value = false
    newKeyName.value = ''
    newKeyExpires.value = 90
    toast.add({ title: 'API Key created successfully', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err.message || 'Failed to create API key', color: 'error' })
  } finally {
    creating.value = false
  }
}

const handleDelete = async (keyId: string) => {
  deleteLoading.value = keyId
  try {
    await deleteApiKey(keyId)
    toast.add({ title: 'API Key deleted successfully', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err.message || 'Failed to delete API key', color: 'error' })
  } finally {
    deleteLoading.value = null
  }
}

const handleCopy = async () => {
  if (newApiKey.value) {
    const success = await copyToClipboard(newApiKey.value.key)
    if (success) {
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    }
  }
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return t('never')
  return new Date(dateStr).toLocaleDateString()
}

useHead({
  title: t('title'),
  meta: [{ name: 'description', content: t('description') }]
})
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold mb-2">{{ t('heading') }}</h1>
        <p class="text-muted-foreground">{{ t('subheading') }}</p>
      </div>

      <UButton v-if="activeBusinessId" icon="i-lucide-plus" @click="showCreateModal = true">
        {{ t('createButton') }}
      </UButton>
    </div>

    <div v-if="!activeBusinessId" class="text-center py-12">
      <UIcon name="i-lucide-building-2" class="w-12 h-12 text-muted-foreground mb-4" />
      <h3 class="text-lg font-medium mb-2">{{ t('noBusiness') }}</h3>
      <p class="text-muted-foreground">{{ t('noBusinessDescription') }}</p>
    </div>

    <div v-else-if="apiKeys && apiKeys.length === 0 && !loading" class="text-center py-12">
      <UIcon name="i-lucide-key" class="w-12 h-12 text-muted-foreground mb-4" />
      <h3 class="text-lg font-medium mb-2">{{ t('noKeys') }}</h3>
      <p class="text-muted-foreground mb-4">{{ t('noKeysDescription') }}</p>
      <UButton icon="i-lucide-plus" @click="showCreateModal = true">
        {{ t('createButton') }}
      </UButton>
    </div>

    <UTable v-else :data="apiKeys" :loading="loading" class="w-full">
      <template #columns>
        <UTableColumn :label="t('columns.name')" key="name">
          <template #cell="{ row }">
            <div class="font-medium">{{ row.name }}</div>
          </template>
        </UTableColumn>
        <UTableColumn :label="t('columns.prefix')" key="prefix">
          <template #cell="{ row }">
            <code class="text-sm bg-muted px-2 py-1 rounded">{{ row.prefix }}****</code>
          </template>
        </UTableColumn>
        <UTableColumn :label="t('columns.created')" key="created">
          <template #cell="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </UTableColumn>
        <UTableColumn :label="t('columns.expires')" key="expires">
          <template #cell="{ row }">
            {{ formatDate(row.expiresAt) }}
          </template>
        </UTableColumn>
        <UTableColumn :label="t('columns.actions')" key="actions">
          <template #cell="{ row }">
            <UButton variant="ghost" color="error" size="sm" icon="i-lucide-trash-2" :loading="deleteLoading === row.id"
              @click="handleDelete(row.id)" />
          </template>
        </UTableColumn>
      </template>
    </UTable>

    <UModal v-model:open="showCreateModal" :title="t('createButton')">
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">{{ t('keyName') }}</label>
            <UInput v-model="newKeyName" :placeholder="t('keyNamePlaceholder')" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">{{ t('expiresIn') }}</label>
            <USelect v-model="newKeyExpires" :items="expirationOptions" value-key="value" label-key="label" />
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="showCreateModal = false">
            {{ t('cancel') }}
          </UButton>
          <UButton :loading="creating" @click="handleCreate">
            {{ t('create') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showKeyModal" :title="t('keyCreated')" :close="false">
      <template #body>
        <div class="space-y-4">
          <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p class="text-sm text-yellow-800 font-medium">{{ t('keyCreatedDescription') }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">{{ t('keyName') }}</label>
            <p class="font-medium">{{ newApiKey?.name }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">API Key</label>
            <div class="flex gap-2">
              <code class="flex-1 p-3 bg-muted rounded font-mono text-sm break-all">
            {{ newApiKey?.key }}
          </code>
              <UButton :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="handleCopy">
                {{ copied ? t('copied') : t('copy') }}
              </UButton>
            </div>
          </div>
          <div v-if="newApiKey?.metadata?.businessName">
            <label class="block text-sm font-medium mb-2">Business</label>
            <p>{{ newApiKey.metadata.businessName }}</p>
          </div>
          <div v-if="newApiKey?.metadata?.connectedPlatforms?.length">
            <label class="block text-sm font-medium mb-2">{{ t('platforms') }}</label>
            <div class="flex gap-2 flex-wrap">
              <UBadge v-for="platform in newApiKey.metadata.connectedPlatforms" :key="platform">
                {{ platform }}
              </UBadge>
            </div>
          </div>
        </div>
        <div class="flex justify-end">
          <UButton @click="closeKeyModal">
            {{ t('close') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
