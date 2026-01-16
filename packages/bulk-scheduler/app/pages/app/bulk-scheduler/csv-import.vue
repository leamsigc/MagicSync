<!--  Translation file -->
<i18n src="./csv-import.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: CSV Import page for bulk scheduling
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { useBusinessManager } from '#layers/BaseConnect/app/pages/app/business/composables/useBusinessManager'
import { useSocialMediaManager } from '#layers/BaseConnect/app/composables/UseSocialMediaManager'
import type { Asset } from '#layers/BaseDB/db/schema'

const { t } = useI18n()
const { importFromCsv, isLoading } = useBulkScheduler()
const { businesses, activeBusinessId, getAllBusinesses } = useBusinessManager()
const { connectedSocialAccountsList, getAllSocialMediaAccounts } = useSocialMediaManager()
const router = useRouter()

const currentStep = ref(1)
const selectedFile = ref<File | null>(null)
const selectedPlatforms = ref<string[]>([])
const dateRange = ref<{ startDate: Date; endDate: Date } | null>(null)
const distributeEvenly = ref(false)
const selectedBusinessId = ref(activeBusinessId.value || '')
const selectedAssets = ref<Asset[]>([])

onMounted(async () => {
  await getAllSocialMediaAccounts()
  if (businesses.value.data.length === 0) {
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
  return businesses.value.data.map(b => ({
    label: b.name,
    value: b.id
  }))
})

const handleFileSelected = (file: File) => {
  selectedFile.value = file
  currentStep.value = 2
}

const handleTogglePlatform = (account: any) => {
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

const canProceed = computed(() => {
  return selectedFile.value && selectedPlatforms.value.length > 0 && selectedBusinessId.value
})

  const handleImport = async () => {
    if (!selectedFile.value || !selectedBusinessId.value || selectedPlatforms.value.length === 0) {
      return
    }

    try {
      await importFromCsv(
        selectedFile.value,
        selectedPlatforms.value,
        selectedBusinessId.value,
        dateRange.value || undefined,
        distributeEvenly.value,
        selectedAssets.value
      )

      router.push('/app/bulk-scheduler')
    } catch (error) {
      console.error('Import failed:', error)
    }
  }
</script>

<template>
  <div class="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
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
          :class="currentStep >= 1 ? 'bg-primary text-white' : 'bg-gray-200'">
          1
        </div>
        <div class="w-12 h-1 bg-gray-200" :class="{ 'bg-primary': currentStep >= 2 }" />
        <div class="flex items-center justify-center w-8 h-8 rounded-full"
          :class="currentStep >= 2 ? 'bg-primary text-white' : 'bg-gray-200'">
          2
        </div>
        <div class="w-12 h-1 bg-gray-200" :class="{ 'bg-primary': currentStep >= 3 }" />
        <div class="flex items-center justify-center w-8 h-8 rounded-full"
          :class="currentStep >= 3 ? 'bg-primary text-white' : 'bg-gray-200'">
          3
        </div>
      </div>
    </div>

    <UCard>
      <div v-if="currentStep === 1" class="space-y-4">
        <h2 class="text-xl font-semibold">{{ t('csvImport.step1.title') }}</h2>
        <p class="text-gray-600">{{ t('csvImport.step1.description') }}</p>
        <CsvUploader @file-selected="handleFileSelected" />
      </div>

      <div v-if="currentStep === 2" class="space-y-6">
        <div>
          <h2 class="text-xl font-semibold">{{ t('csvImport.step2.title') }}</h2>
          <p class="text-gray-600">{{ t('csvImport.step2.description') }}</p>
        </div>

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

        <div class="flex gap-2 justify-end">
          <UButton variant="soft" @click="currentStep = 1">
            {{ t('common.back') }}
          </UButton>
          <UButton color="primary" :disabled="!canProceed || isLoading" :loading="isLoading" @click="handleImport">
            {{ t('csvImport.import') }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
