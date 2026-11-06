<!--  Translation file -->
<i18n src="./design-assets.json"></i18n>

<script lang="ts" setup>
/**
 * Admin design-assets browser — read-only view of rendered outputs,
 * template media and stock copies stored on the server. Every row links to
 * the public serve route (`/api/v1/image-editor/assets/<name>`).
 */
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'

definePageMeta({
  layout: 'dashboard-layout',
})

interface DesignAssetRow {
  name: string
  bytes: number
  mimeType: string
}

const { t } = useI18n()
const toast = useToast()

const loading = ref(false)
const assets = ref<DesignAssetRow[]>([])
const totalBytes = ref(0)
const query = ref('')

const filtered = computed(() => {
  const term = query.value.trim().toLowerCase()
  if (!term) return assets.value
  return assets.value.filter(asset => asset.name.toLowerCase().includes(term))
})

const countLabel = computed(() => t('count', {
  count: filtered.value.length,
  size: formatBytes(totalBytes.value),
}))

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'name', label: t('col_name') },
  { key: 'mimeType', label: t('col_type'), hideBelow: 'sm' },
  { key: 'bytes', label: t('col_size'), align: 'right' },
  { key: 'actions', label: t('col_actions'), align: 'right' },
])

async function fetchAssets(): Promise<void> {
  loading.value = true
  try {
    const response = await $fetch<{ assets: DesignAssetRow[]; totalBytes: number }>('/api/v1/image-editor/assets')
    assets.value = response.assets ?? []
    totalBytes.value = response.totalBytes ?? 0
  } catch {
    toast.add({ title: t('title'), description: t('empty_hint'), color: 'error', icon: 'i-lucide-x-circle' })
  }
  loading.value = false
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function assetUrl(name: string): string {
  return `/api/v1/image-editor/assets/${encodeURIComponent(name)}`
}

async function copyUrl(name: string): Promise<void> {
  await navigator.clipboard.writeText(assetUrl(name))
  toast.add({ title: t('copied'), description: name, color: 'success', icon: 'i-lucide-clipboard-check' })
}

onMounted(fetchAssets)

useHead({ title: t('seo_title') })
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-highlighted">{{ t('title') }}</h1>
        <p class="text-sm text-muted">{{ t('description') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted">{{ countLabel }}</span>
        <UButton size="sm" variant="ghost" icon="lucide:refresh-ccw" :loading="loading" @click="fetchAssets">
          {{ t('refresh') }}
        </UButton>
      </div>
    </div>

    <UInput v-model="query" icon="lucide:search" :placeholder="t('search_placeholder')" class="max-w-sm" />

    <div class="border border-default rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-muted/60 text-xs text-muted">
          <tr>
            <th v-for="column in columns" :key="column.key" class="px-3 py-2 text-left font-medium"
              :class="column.align === 'right' ? 'text-right' : ''">
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="asset in filtered" :key="asset.name" class="border-t border-default hover:bg-elevated/40">
            <td class="px-3 py-2 font-mono text-xs truncate max-w-64">{{ asset.name }}</td>
            <td class="px-3 py-2 text-xs text-muted">{{ asset.mimeType }}</td>
            <td class="px-3 py-2 text-xs text-right tabular-nums">{{ formatBytes(asset.bytes) }}</td>
            <td class="px-3 py-2 text-right whitespace-nowrap">
              <UButton size="xs" variant="ghost" icon="lucide:external-link" :to="assetUrl(asset.name)" target="_blank" :aria-label="t('open')" />
              <UButton size="xs" variant="ghost" icon="lucide:clipboard" :aria-label="t('copy')" @click="copyUrl(asset.name)" />
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!loading && filtered.length === 0" class="p-8 text-center space-y-2">
        <Icon name="lucide:folder-open" class="w-8 h-8 text-dimmed mx-auto" />
        <p class="text-sm font-medium">{{ t('empty') }}</p>
        <p class="text-xs text-muted">{{ t('empty_hint') }}</p>
      </div>
    </div>
  </div>
</template>
