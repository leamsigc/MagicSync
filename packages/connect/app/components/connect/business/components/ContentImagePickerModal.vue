<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import { contentApiError } from '../../../../utils/content-api-error'

/**
 * Pick an image out of the business's own assets and drop it into the article
 * (PRD-CONTENT-PIPELINE-OVERHAUL §10 D09). No new backend: the list comes from
 * the existing `GET /api/v1/assets` with `mimeType=image`, which the route
 * turns into a `LIKE 'image%'` filter and answers as
 * `{ success, data: Asset[], pagination }`. Insertion is the host's business —
 * this only hands back a URL.
 */

interface AssetRow {
  id: string
  filename: string
  originalName: string
  mimeType: string
  url: string
  thumbnailUrl?: string | null
}

interface AssetResponse {
  data?: AssetRow[]
}

const props = defineProps<{ businessId: string }>()

const emit = defineEmits<{ select: [url: string] }>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()

const assets = ref<AssetRow[]>([])
const loading = ref(false)
const failed = ref(false)

/** The route reads `mimeType` as a prefix, so `image` is already images only. */
function thumbOf(asset: AssetRow): string {
  return asset.thumbnailUrl || asset.url
}

async function load() {
  loading.value = true
  failed.value = false
  try {
    const response = await $fetch<AssetResponse>('/api/v1/assets', {
      query: { businessId: props.businessId, mimeType: 'image', page: 1, limit: 60 },
    })
    assets.value = response.data ?? []
  }
  catch (error) {
    assets.value = []
    failed.value = true
    log.error({ message: 'assets failed to load', businessId: props.businessId, error: String(error) })
    toast.add({ title: t('assets.failed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    loading.value = false
  }
}

function handleSelect(url: string) {
  emit('select', url)
}

watch(open, (value) => {
  if (value) void load()
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('assets.title')"
    :description="t('assets.hint')"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div data-testid="image-picker">
        <div v-if="loading" v-motion-fade :duration="200" class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-heroicons-arrow-path" class="size-4 animate-spin" />
          {{ t('assets.loading') }}
        </div>
        <p v-else-if="failed" v-motion-fade :duration="200" class="text-sm text-error">
          {{ t('assets.failed') }}
        </p>
        <p v-else-if="assets.length === 0" v-motion-fade :duration="200" class="text-sm text-muted">
          {{ t('assets.empty') }}
        </p>
        <div v-else class="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          <button
            v-for="asset in assets"
            :key="asset.id"
            type="button"
            class="group overflow-hidden rounded-lg border border-default transition-colors hover:border-primary"
            :data-testid="`asset-${asset.id}`"
            @click="handleSelect(asset.url)"
          >
            <img
              :src="thumbOf(asset)"
              :alt="asset.originalName"
              loading="lazy"
              class="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-105"
            >
            <span class="block truncate px-1.5 py-1 text-left text-[11px] text-muted">
              {{ asset.originalName }}
            </span>
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>