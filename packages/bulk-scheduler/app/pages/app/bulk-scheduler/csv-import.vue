<i18n src="./csv-import.json"></i18n>

<script lang="ts" setup>
import { useBusinessManager } from '#layers/BaseConnect/app/pages/app/business/composables/useBusinessManager'
import { useSocialMediaManager } from '#layers/BaseConnect/app/composables/UseSocialMediaManager'
import type { Asset } from '#layers/BaseDB/db/schema'
import { parseCsvFile, convertCsvToString } from '#layers/BaseBulkScheduler/utils/csvParser'

const { t } = useI18n()
const { importFromCsv, isLoading } = useBulkScheduler()
const { businesses, activeBusinessId, getAllBusinesses } = useBusinessManager()
const { connectedSocialAccountsList, getAllSocialMediaAccounts } = useSocialMediaManager()
const router = useRouter()
const toast = useToast()

const currentStep = ref(1)
const selectedFile = ref<File | null>(null)
const selectedPlatforms = ref<string[]>([])
const dateRange = ref<{ startDate: Date; endDate: Date } | null>(null)
const distributeEvenly = ref(false)
const selectedBusinessId = ref(activeBusinessId.value || '')
const selectedAssets = ref<Asset[]>([])
const csvRows = ref<Array<{ content: string; image_url: string; scheduled_time: string; comments: string }>>([])
const selectedAssetsPerRow = ref<Record<number, Asset[]>>({})

const showAiModal = ref(false)
const showAssetModal = ref(false)
const assetModalRowIndex = ref<number | null>(null)
const currentRowAssets = ref<Asset[]>([])

const csvColumns = [
  { key: 'content', label: t('csvImport.columns.content'), required: true, description: t('csvImport.columns.contentDesc') },
  { key: 'image_url', label: t('csvImport.columns.imageUrl'), required: false, description: t('csvImport.columns.imageUrlDesc') },
  { key: 'scheduled_time', label: t('csvImport.columns.scheduledTime'), required: false, description: t('csvImport.columns.scheduledTimeDesc') },
  { key: 'comments', label: t('csvImport.columns.comments'), required: false, description: t('csvImport.columns.commentsDesc') }
]

onMounted(async () => {
  await getAllSocialMediaAccounts()
  if ((businesses.value?.data?.length ?? 0) === 0) {
    await getAllBusinesses()
  }
  if (!selectedBusinessId.value && activeBusinessId.value) {
    selectedBusinessId.value = activeBusinessId.value
  }
})

watch(activeBusinessId, (newId) => {
  if (newId && !selectedBusinessId.value) {
    selectedBusinessId.value = newId
  }
})

const businessOptions = computed(() => {
  return businesses.value?.data?.map(b => ({
    label: b.name,
    value: b.id
  }))
})

const isoToDatetimeLocal = (iso: string | Date | null | undefined): string => {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const handleFileSelected = async (file: File) => {
  selectedFile.value = file
  try {
    const result = await parseCsvFile(file)
    if (result.success && result.data) {
      csvRows.value = result.data.map(post => ({
        content: post.content || '',
        image_url: (Array.isArray(post.mediaAssets) && post.mediaAssets.length > 0) ? post.mediaAssets[0] : '',
        scheduled_time: isoToDatetimeLocal(post.scheduledAt),
        comments: Array.isArray(post.comment) ? post.comment.join(';') : ''
      }))
      currentStep.value = 2
    } else {
      toast.add({
        title: t('errors.csvParseError'),
        description: result.errors?.join(', ') || t('errors.csvParseUnknown'),
        icon: 'i-heroicons-x-circle',
        color: 'error'
      })
    }
  } catch {
    toast.add({
      title: t('errors.csvParseError'),
      icon: 'i-heroicons-x-circle',
      color: 'error'
    })
  }
}

const handleAiGenerated = (rows: Array<{ content: string; image_url: string; scheduled_time: string; comments: string }>) => {
  csvRows.value = rows.map(r => ({
    ...r,
    scheduled_time: isoToDatetimeLocal(r.scheduled_time)
  }))
  showAiModal.value = false
  currentStep.value = 2
}

const handleTogglePlatform = (account: { id: string }) => {
  const index = selectedPlatforms.value.indexOf(account.id)
  if (index > -1) {
    selectedPlatforms.value.splice(index, 1)
  } else {
    selectedPlatforms.value.push(account.id)
  }
}

const handleDateRangeUpdate = (range: { startDate: Date; endDate: Date }) => {
  dateRange.value = range
}

const updateRowContent = (index: number, field: string, value: string) => {
  if (csvRows.value[index]) {
    (csvRows.value[index] as any)[field] = value
  }
}

const removeRow = (index: number) => {
  csvRows.value.splice(index, 1)
  const newAssets: Record<number, Asset[]> = {}
  for (const [key, val] of Object.entries(selectedAssetsPerRow.value)) {
    const k = Number(key)
    if (k < index) newAssets[k] = val
    else if (k > index) newAssets[k - 1] = val
  }
  selectedAssetsPerRow.value = newAssets
}

const openAssetSelector = (index: number) => {
  if (!selectedAssetsPerRow.value[index]) {
    selectedAssetsPerRow.value[index] = []
  }
  currentRowAssets.value = selectedAssetsPerRow.value[index]
  assetModalRowIndex.value = index
  showAssetModal.value = true
}

watch(showAssetModal, (isOpen) => {
  if (!isOpen && assetModalRowIndex.value !== null) {
    selectedAssetsPerRow.value[assetModalRowIndex.value] = [...currentRowAssets.value]
  }
})

const hasImageUrl = (row: typeof csvRows.value[0]) => row.image_url && row.image_url.trim() !== ''

const canProceed = computed(() => {
  return csvRows.value.length > 0 && selectedPlatforms.value.length > 0 && selectedBusinessId.value
})

const handleImport = async () => {
  if (!selectedBusinessId.value || selectedPlatforms.value.length === 0 || csvRows.value.length === 0) {
    return
  }

  const exportRows = csvRows.value.map(r => ({
    ...r,
    scheduled_time: r.scheduled_time ? new Date(r.scheduled_time).toISOString() : ''
  }))
  const csvString = convertCsvToString(exportRows)
  const blob = new Blob([csvString], { type: 'text/csv' })
  const file = new File([blob], selectedFile.value?.name || 'generated-posts.csv', { type: 'text/csv' })

  try {
    const rowAssetIds: string[] = []
    for (const assets of Object.values(selectedAssetsPerRow.value)) {
      rowAssetIds.push(...assets.map(a => a.id))
    }
    const allAssets = [...selectedAssets.value, ...rowAssetIds.map(id => ({ id } as Asset))]

    await importFromCsv(
      file,
      selectedPlatforms.value,
      selectedBusinessId.value,
      dateRange.value || undefined,
      distributeEvenly.value,
      allAssets
    )

    router.push('/app/bulk-scheduler')
  } catch (error) {
    console.error('Import failed:', error)
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold">{{ t('csvImport.title') }}</h1>
        <p class="text-gray-600 mt-1">{{ t('csvImport.subtitle') }}</p>
      </div>
      <UButton to="/app/bulk-scheduler" variant="ghost" icon="i-heroicons-arrow-left">
        {{ t('common.back') }}
      </UButton>
    </div>

    <div class="flex items-center justify-center mb-8">
      <div class="flex items-center gap-2">
        <div class="flex items-center justify-center w-8 h-8 rounded-full"
          :class="currentStep >= 1 ? 'bg-primary' : 'bg-gray-500 text-white'">
          1
        </div>
        <div class="w-12 h-px dark:bg-gray-200 bg-gray-500" :class="{ 'bg-primary': currentStep >= 2 }" />
        <div class="flex items-center justify-center w-8 h-8 rounded-full"
          :class="currentStep >= 2 ? 'bg-primary' : 'bg-gray-500 text-white'">
          2
        </div>
        <div class="w-12 h-px dark:bg-gray-200 bg-gray-500" :class="{ 'bg-primary': currentStep >= 3 }" />
        <div class="flex items-center justify-center w-8 h-8 rounded-full"
          :class="currentStep >= 3 ? 'bg-primary' : 'bg-gray-500 text-white'">
          3
        </div>
      </div>
    </div>

    <UCard>
      <!-- Step 1: Upload CSV or Generate with AI -->
      <div v-if="currentStep === 1" class="space-y-6">
        <div>
          <h2 class="text-xl font-semibold">{{ t('csvImport.step1.title') }}</h2>
          <p class="text-gray-600">{{ t('csvImport.step1.description') }}</p>
        </div>

        <!-- CSV Upload -->
        <div class="space-y-2">
          <h3 class="text-lg font-medium">{{ t('csvImport.step1.uploadTitle') }}</h3>
          <CsvUploader @file-selected="handleFileSelected" />
        </div>

        <div class="relative">
          <div class="relative flex justify-center text-sm">
            <span class="px-2  text-gray-500 heading font-black">{{ t('csvImport.step1.or') }}</span>
          </div>
        </div>

        <!-- Generate with AI -->
        <div class="space-y-2">
          <h3 class="text-lg font-medium">{{ t('csvImport.step1.aiTitle') }}</h3>
          <p class="text-sm text-gray-600">{{ t('csvImport.step1.aiDescription') }}</p>
          <UButton color="secondary" variant="soft" icon="i-heroicons-sparkles" @click="showAiModal = true">
            {{ t('csvImport.step1.generateWithAi') }}
          </UButton>
        </div>

        <!-- CSV Columns Reference -->
        <div class="bg-gray-50 dark:bg-transparent rounded-lg p-4 space-y-3">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-500">
            {{ t('csvImport.columns.title') }}
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div v-for="col in csvColumns" :key="col.key"
              class="flex items-start gap-2 p-2  rounded border border-gray-200 dark:border-gray-600">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <code
                    class="text-sm font-mono font-medium text-primary-600 dark:text-primary-400">{{ col.label }}</code>
                  <UBadge v-if="col.required" size="xs" color="error" variant="solid">
                    {{ t('csvImport.columns.required') }}
                  </UBadge>
                  <UBadge v-else size="xs" color="neutral" variant="subtle">{{ t('csvImport.columns.optional') }}
                  </UBadge>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ col.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Preview & Edit CSV Data -->
      <div v-if="currentStep === 2" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-semibold">{{ t('csvImport.step2.title') }}</h2>
            <p class="text-gray-600">{{ t('csvImport.step2.description') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">{{ csvRows.length }} {{ t('csvImport.step2.rows') }}</span>
            <UButton v-if="selectedFile" variant="soft" size="sm" @click="currentStep = 1">
              {{ t('common.changeFile') }}
            </UButton>
          </div>
        </div>

        <!-- CSV Data Table -->
        <div class="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table class="w-full text-sm text-left border-collapse">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800">
                <th class="p-3 font-medium text-gray-600 dark:text-gray-300 w-8">#</th>
                <th class="p-3 font-medium text-gray-600 dark:text-gray-300 min-w-[250px]">
                  {{ t('csvImport.columns.content') }} <span class="text-red-500">*</span>
                </th>
                <th class="p-3 font-medium text-gray-600 dark:text-gray-300 min-w-[180px]">
                  {{ t('csvImport.columns.imageUrl') }}
                </th>
                <th class="p-3 font-medium text-gray-600 dark:text-gray-300 min-w-[160px]">
                  {{ t('csvImport.columns.scheduledTime') }}
                </th>
                <th class="p-3 font-medium text-gray-600 dark:text-gray-300 min-w-[180px]">
                  {{ t('csvImport.columns.comments') }}
                </th>
                <th class="p-3 font-medium text-gray-600 dark:text-gray-300 w-16">{{ t('csvImport.step2.actions') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in csvRows" :key="rowIndex"
                class="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td class="p-3 text-gray-400 text-xs align-top pt-4">{{ rowIndex + 1 }}</td>
                <td class="p-2">
                  <UTextarea :model-value="row.content"
                    @update:model-value="updateRowContent(rowIndex, 'content', $event)" :rows="3" autoresize
                    class="w-full text-sm" :placeholder="t('csvImport.step2.contentPlaceholder')" />
                </td>
                <td class="p-2 align-top">
                  <div class="space-y-2">
                    <div class="flex items-center gap-1">
                      <UInput :model-value="row.image_url"
                        @update:model-value="updateRowContent(rowIndex, 'image_url', $event)" size="sm"
                        :placeholder="t('csvImport.step2.imageUrlPlaceholder')" class="flex-1" />
                      <UButton v-if="row.image_url" icon="i-heroicons-x-mark" color="neutral" variant="ghost"
                        size="2xs" @click="updateRowContent(rowIndex, 'image_url', '')" />
                    </div>
                    <div v-if="hasImageUrl(row)" class="relative group">
                      <img :src="row.image_url" alt="Preview"
                        class="w-16 h-16 object-cover rounded border border-gray-200"
                        @error="($event.target as HTMLImageElement).style.display = 'none'" />
                      <UButton icon="i-heroicons-x-mark" color="error" variant="solid" size="2xs"
                        class="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                        @click="updateRowContent(rowIndex, 'image_url', '')" />
                    </div>
                    <UButton color="neutral" variant="ghost" size="xs" icon="i-heroicons-photo"
                      @click="openAssetSelector(rowIndex)">
                      {{ t('csvImport.step2.browseAssets') }}
                    </UButton>
                  </div>
                </td>
                <td class="p-2 align-top">
                  <UInput :model-value="row.scheduled_time"
                    @update:model-value="updateRowContent(rowIndex, 'scheduled_time', $event)" size="sm"
                    type="datetime-local" class="w-full" />
                </td>
                <td class="p-2 align-top">
                  <div class="flex items-start gap-1">
                    <UTextarea :model-value="row.comments"
                      @update:model-value="updateRowContent(rowIndex, 'comments', $event)" :rows="2" autoresize
                      class="w-full text-sm" :placeholder="t('csvImport.step2.commentsPlaceholder')" />
                    <UButton v-if="row.comments" icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="2xs"
                      class="mt-1 shrink-0" @click="updateRowContent(rowIndex, 'comments', '')" />
                  </div>
                </td>
                <td class="p-2 align-top pt-3">
                  <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="xs"
                    @click="removeRow(rowIndex)" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Configuration Settings -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-medium">{{ t('csvImport.step2.settings') }}</h3>
          </template>

          <div class="space-y-4">
            <UFormField :label="t('csvImport.businessId')" name="businessId">
              <USelectMenu v-model="selectedBusinessId" :options="businessOptions" value-attribute="value"
                option-attribute="label" class="w-full" :placeholder="t('csvImport.businessIdPlaceholder')" />
            </UFormField>

            <PlatformSelector :accounts="connectedSocialAccountsList" :selected-ids="selectedPlatforms"
              @toggle="handleTogglePlatform" />

            <UCheckbox v-model="distributeEvenly" :label="t('csvImport.distributeEvenly')" />

            <div v-if="distributeEvenly">
              <DateRangeSelector @update="handleDateRangeUpdate" />
            </div>

            <div class="mt-6">
              <h3 class="text-lg font-medium mb-2">{{ t('csvImport.selectAssets') }}</h3>
              <p class="text-sm text-gray-600 mb-4">{{ t('csvImport.selectAssetsDescription') }}</p>
              <MediaGalleryForUser v-model:selected="selectedAssets" />
            </div>
          </div>
        </UCard>

        <div class="flex gap-2 justify-end">
          <UButton variant="soft" @click="currentStep = 1">
            {{ t('common.back') }}
          </UButton>
          <UButton color="primary" :disabled="!canProceed || isLoading" :loading="isLoading" @click="handleImport">
            {{ t('csvImport.import') }}
          </UButton>
        </div>
      </div>

      <!-- Step 3: Review (placeholder) -->
      <div v-if="currentStep === 3" class="space-y-4">
        <h2 class="text-xl font-semibold">{{ t('csvImport.step3.title') }}</h2>
        <p class="text-gray-600">{{ t('csvImport.step3.description') }}</p>
      </div>
    </UCard>

    <!-- AI Generate Modal -->
    <UModal v-model:open="showAiModal">
      <template #content>
        <AiCsvGeneratorModal @generated="handleAiGenerated" @close="showAiModal = false" />
      </template>
    </UModal>

    <!-- Per-Row Asset Selector Modal -->
    <UModal v-model:open="showAssetModal">
      <template #content>
        <UCard v-if="assetModalRowIndex !== null">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold">{{ t('csvImport.step2.selectAsset') }} - {{ t('csvImport.step2.row') }} {{
                (assetModalRowIndex ?? 0) + 1 }}</h3>
              <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" @click="showAssetModal = false" />
            </div>
          </template>
          <MediaGalleryForUser v-model:selected="currentRowAssets" />
        </UCard>
      </template>
    </UModal>
  </div>
</template>
