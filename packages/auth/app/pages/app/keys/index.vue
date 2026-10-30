<i18n src="./index.json"></i18n>

<script lang="ts" setup>
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'
import type { OAuthGrantItem } from '../../../composables/useOAuthGrants'

const { t } = useI18n()
const activeBusinessId = useState<string>('business:id')
const toast = useToast()
const {
  apiKeys,
  loading,
  newApiKey,
  showKeyModal,
  fetchApiKeys,
  createApiKey,
  deleteApiKey,
  closeKeyModal,
  copyToClipboard,
} = useApiKeyManagement()
const {
  grants,
  loading: grantsLoading,
  fetchGrants,
  revokeGrant,
} = useOAuthGrants()

const revokeLoading = ref<string | null>(null)
const showCreateModal = ref(false)
const newKeyName = ref('')
const newKeyExpires = ref(90)
const creating = ref(false)
const deleteLoading = ref<string | null>(null)
const copied = ref(false)

const expirationOptions = computed(() => [
  { label: t('expirationOptions.30'), value: 30 * 24 * 60 * 60 },
  { label: t('expirationOptions.60'), value: 60 * 24 * 60 * 60 },
  { label: t('expirationOptions.90'), value: 90 * 24 * 60 * 60 },
  { label: t('expirationOptions.180'), value: 6 * 30 * 24 * 60 * 60 },
  { label: t('expirationOptions.365'), value: 365 * 24 * 60 * 60 },
  { label: t('expirationOptions.never'), value: 0 },
])

const keyRows = computed<Record<string, any>[]>(() => (apiKeys.value ?? []).map(key => ({ ...key })))
const grantRows = computed<Record<string, any>[]>(() => (grants.value ?? []).map(grant => ({ ...grant })))

const { search, setSearch, sort, setSort, filtered, hasActiveFilters, resetFilters } = useCollectionView<Record<string, any>>({
  key: 'app-keys',
  modes: ['table'],
  defaultView: 'table',
  rows: keyRows,
  searchFields: key => [key.name, key.prefix, key.id],
  sorters: {
    newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    oldest: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  },
  initialSort: 'newest',
})

const sortOptions = computed(() => [
  { value: 'newest', label: t('sortNewest') },
  { value: 'oldest', label: t('sortOldest') },
])

const toolbarSort = computed(() => ({ value: sort.value, options: sortOptions.value }))

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'id', label: t('columns.id'), hideBelow: 'md' },
  { key: 'name', label: t('columns.name') },
  { key: 'prefix', label: t('columns.prefix'), hideBelow: 'sm' },
  { key: 'createdAt', label: t('columns.created'), hideBelow: 'md' },
  { key: 'expiresAt', label: t('columns.expires'), hideBelow: 'lg' },
])

const grantColumns = computed<CollectionTableColumn[]>(() => [
  { key: 'clientName', label: t('grantClient') },
  { key: 'scopes', label: t('grantScopes'), hideBelow: 'sm' },
  { key: 'businessName', label: t('grantBusiness'), hideBelow: 'md' },
  { key: 'createdAt', label: t('grantGranted'), hideBelow: 'lg' },
])

const grantRowKey = (grant: Record<string, any>): string => String(grant.id)

watch(activeBusinessId, (newVal) => {
  if (newVal) {
    void fetchApiKeys(newVal)
  }
}, { immediate: true })

onMounted(() => {
  void fetchGrants()
})

function grantAccessLabel(scopes: string[]): string {
  return scopes.includes('mcp:full') ? t('scopeFull') : t('scopeRead')
}

function grantClientLabel(grant: OAuthGrantItem): string {
  return grant.clientName || grant.clientId
}

function grantBusinessLabel(grant: OAuthGrantItem): string {
  return grant.businessName || grant.businessId || '—'
}

function errorText(error: unknown, fallbackKey: string): string {
  return error instanceof Error && error.message ? error.message : t(fallbackKey)
}

function formatDate(dateStr: string | null): string {
  return dateStr ? new Date(dateStr).toLocaleDateString() : t('never')
}

function handleOpenCreate() {
  showCreateModal.value = true
}

function handleCloseCreate() {
  showCreateModal.value = false
}

async function handleRevokeGrant(id: string): Promise<void> {
  revokeLoading.value = id
  try {
    await revokeGrant(id)
    toast.add({ title: t('grantRevoked'), color: 'success' })
  }
  catch (error: unknown) {
    toast.add({ title: errorText(error, 'grantRevokeFailed'), color: 'error' })
  }
  finally {
    revokeLoading.value = null
  }
}

async function handleCreate(): Promise<void> {
  if (!newKeyName.value.trim()) {
    toast.add({ title: t('keyNameRequired'), color: 'error' })
    return
  }

  creating.value = true
  try {
    await createApiKey(newKeyName.value, activeBusinessId.value, newKeyExpires.value || undefined)
    showCreateModal.value = false
    newKeyName.value = ''
    newKeyExpires.value = 90
    toast.add({ title: t('keyCreatedSuccess'), color: 'success' })
  }
  catch (error: unknown) {
    toast.add({ title: errorText(error, 'keyCreateFailed'), color: 'error' })
  }
  finally {
    creating.value = false
  }
}

async function handleDelete(keyId: string): Promise<void> {
  deleteLoading.value = keyId
  try {
    await deleteApiKey(keyId)
    toast.add({ title: t('keyDeletedSuccess'), color: 'success' })
  }
  catch (error: unknown) {
    toast.add({ title: errorText(error, 'keyDeleteFailed'), color: 'error' })
  }
  finally {
    deleteLoading.value = null
  }
}

async function handleCopy(): Promise<void> {
  if (!newApiKey.value) return
  const success = await copyToClipboard(newApiKey.value.key)
  if (!success) return
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

useHead({
  title: t('title'),
  meta: [{ name: 'description', content: t('description') }],
})
</script>

<template>
  <BaseCollectionPage :title="t('heading')" :description="t('subheading')">
    <template #actions>
      <UButton v-if="activeBusinessId" icon="i-lucide-plus" @click="handleOpenCreate">
        {{ t('createButton') }}
      </UButton>
    </template>

    <template #toolbar>
      <BaseCollectionToolbar
        v-if="activeBusinessId"
        :search="search"
        :search-placeholder="t('searchKeys')"
        :sort="toolbarSort"
        @update:search="setSearch"
        @update:sort="setSort"
      />
    </template>

    <div v-if="!activeBusinessId" class="py-12 text-center">
      <UIcon name="i-lucide-building-2" class="mx-auto mb-4 size-12 text-dimmed" />
      <h3 class="mb-2 text-lg font-medium">{{ t('noBusiness') }}</h3>
      <p class="text-muted">{{ t('noBusinessDescription') }}</p>
    </div>

    <BaseDataTable
      v-else
      :rows="filtered"
      :columns="columns"
      row-key="id"
      :loading="loading"
      min-width="40rem"
    >
      <template #cell-id="{ row }">
        <span class="font-mono text-xs text-muted">#{{ row.id }}</span>
      </template>
      <template #cell-name="{ row }">
        <span class="font-medium text-highlighted">{{ row.name }}</span>
      </template>
      <template #cell-prefix="{ row }">
        <code class="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs">{{ row.prefix }}</code>
      </template>
      <template #cell-createdAt="{ row }">
        <span class="whitespace-nowrap text-muted">{{ formatDate(row.createdAt) }}</span>
      </template>
      <template #cell-expiresAt="{ row }">
        <span class="whitespace-nowrap text-muted">{{ formatDate(row.expiresAt) }}</span>
      </template>

      <template #row-actions="{ row }">
        <UButton
          variant="ghost"
          color="error"
          size="sm"
          icon="i-lucide-trash-2"
          :loading="deleteLoading === row.id"
          :aria-label="t('delete')"
          @click="() => handleDelete(row.id)"
        />
      </template>

      <template #empty>
        <div v-if="keyRows.length === 0" class="py-10 text-center">
          <UIcon name="i-lucide-key" class="mx-auto mb-3 size-9 text-dimmed" />
          <p class="font-medium text-highlighted">{{ t('noKeys') }}</p>
          <p class="mt-1 text-sm text-muted">{{ t('noKeysDescription') }}</p>
          <UButton class="mt-4" icon="i-lucide-plus" :label="t('createButton')" @click="handleOpenCreate" />
        </div>
        <div v-else class="py-10 text-center">
          <p class="text-sm text-muted">{{ t('noResults') }}</p>
          <UButton
            v-if="hasActiveFilters"
            class="mt-3"
            variant="ghost"
            size="sm"
            icon="i-lucide-filter-x"
            :label="t('clearFilters')"
            @click="resetFilters"
          />
        </div>
      </template>
    </BaseDataTable>

    <section class="mt-10">
      <h2 class="mb-2 text-2xl font-bold">{{ t('connectedApps') }}</h2>
      <p class="mb-6 text-muted">{{ t('connectedAppsDescription') }}</p>

      <BaseDataTable
        :rows="grantRows"
        :columns="grantColumns"
        :row-key="grantRowKey"
        :loading="grantsLoading"
        min-width="40rem"
      >
        <template #cell-clientName="{ row }">
          <span class="font-medium text-highlighted">{{ grantClientLabel(row) }}</span>
        </template>
        <template #cell-scopes="{ row }">
          <UBadge variant="soft">{{ grantAccessLabel(row.scopes) }}</UBadge>
        </template>
        <template #cell-businessName="{ row }">
          <span class="text-muted">{{ grantBusinessLabel(row) }}</span>
        </template>
        <template #cell-createdAt="{ row }">
          <span class="whitespace-nowrap text-muted">{{ formatDate(row.createdAt) }}</span>
        </template>

        <template #row-actions="{ row }">
          <UButton
            variant="ghost"
            color="error"
            size="sm"
            icon="i-lucide-unplug"
            :loading="revokeLoading === row.id"
            :aria-label="t('grantRevoke')"
            @click="() => handleRevokeGrant(row.id)"
          />
        </template>

        <template #empty>
          <div class="py-8 text-center">
            <UIcon name="i-lucide-plug" class="mx-auto mb-3 size-10 text-dimmed" />
            <p class="font-medium text-highlighted">{{ t('noGrants') }}</p>
            <p class="mt-1 text-sm text-muted">{{ t('noGrantsDescription') }}</p>
          </div>
        </template>
      </BaseDataTable>
    </section>

    <UModal v-model:open="showCreateModal" :title="t('createButton')">
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="mb-2 block text-sm font-medium">{{ t('keyName') }}</label>
            <UInput v-model="newKeyName" :placeholder="t('keyNamePlaceholder')" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium">{{ t('expiresIn') }}</label>
            <USelect v-model="newKeyExpires" :items="expirationOptions" value-key="value" label-key="label" />
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="handleCloseCreate">
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
          <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p class="text-sm font-medium text-yellow-800">{{ t('keyCreatedDescription') }}</p>
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium">{{ t('keyName') }}</label>
            <p class="font-medium">{{ newApiKey?.name }}</p>
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium">{{ t('apiKeyLabel') }}</label>
            <div class="flex gap-2">
              <code class="flex-1 break-all rounded bg-muted p-3 font-mono text-sm">
                {{ newApiKey?.key }}
              </code>
              <UButton :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="handleCopy">
                {{ copied ? t('copied') : t('copy') }}
              </UButton>
            </div>
          </div>
          <div v-if="newApiKey?.metadata?.businessName">
            <label class="mb-2 block text-sm font-medium">{{ t('businessLabel') }}</label>
            <p>{{ newApiKey.metadata.businessName }}</p>
          </div>
          <div v-if="newApiKey?.metadata?.connectedPlatforms?.length">
            <label class="mb-2 block text-sm font-medium">{{ t('platforms') }}</label>
            <div class="flex flex-wrap gap-2">
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
  </BaseCollectionPage>
</template>
