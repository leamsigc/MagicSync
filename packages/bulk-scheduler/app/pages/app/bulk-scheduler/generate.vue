<!--  Translation file -->
<i18n src="./generate.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Bulk post generation page with template editor
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
import { extractVariablesFromTemplate } from '#layers/BaseBulkScheduler/utils/templateProcessor'
import { getDefaultSystemVariables } from '#layers/BaseBulkScheduler/utils/templateProcessor'
const { t } = useI18n()
const { generateBulkPosts, isLoading } = useBulkScheduler()
const { businesses, activeBusinessId, getAllBusinesses } = useBusinessManager()
const { connectedSocialAccountsList, getAllSocialMediaAccounts } = useSocialMediaManager()
const router = useRouter()

const templateContent = ref('')
const customVariables = ref<SystemVariable[]>([])
const selectedPlatforms = ref<string[]>([])
const dateRange = ref<{ startDate: Date; endDate: Date }>({
  startDate: new Date(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
})
const postsPerDay = ref(2)
const selectedBusinessId = ref(activeBusinessId.value || '')
const skipWeekends = ref(false)
const businessHoursOnly = ref(false)
const firstComment = ref('')

const templateTextarea = ref<HTMLTextAreaElement | null>(null)

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

const detectTemplateVariables = computed(() => {
  return extractVariablesFromTemplate(templateContent.value)
})

const allVariables = computed(() => {
  const defaults = getDefaultSystemVariables()
  return [...defaults, ...customVariables.value]
})

const addCustomVariable = () => {
  customVariables.value.push({
    key: '',
    value: '',
    description: ''
  })
}

const removeVariable = (index: number) => {
  customVariables.value.splice(index, 1)
}

const handleVariableAction = (content: string) => {
  if (!templateTextarea.value) return

  const start = templateTextarea.value.selectionStart
  const end = templateTextarea.value.selectionEnd
  const text = templateContent.value

  templateContent.value = text.substring(0, start) + content + text.substring(end)

  // Reset cursor position after insertion
  nextTick(() => {
    if (templateTextarea.value) {
      templateTextarea.value.focus()
      templateTextarea.value.setSelectionRange(start + content.length, start + content.length)
    }
  })
}

const canGenerate = computed(() => {
  return (
    templateContent.value.trim() !== '' &&
    selectedPlatforms.value.length > 0 &&
    selectedBusinessId.value.trim() !== '' &&
    postsPerDay.value > 0
  )
})

const handleGenerate = async () => {
  if (!canGenerate.value) return

  try {
    await generateBulkPosts(
      templateContent.value,
      allVariables.value,
      selectedPlatforms.value,
      selectedBusinessId.value,
      dateRange.value,
      postsPerDay.value,
      {
        skipWeekends: skipWeekends.value,
        businessHoursOnly: businessHoursOnly.value,
        firstComment: firstComment.value || undefined
      }
    )

    router.push('/app/bulk-scheduler')
  } catch (error) {
    console.error('Generation failed:', error)
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold">{{ t('generate.title') }}</h1>
        <p class="text-gray-600 mt-1">{{ t('generate.subtitle') }}</p>
      </div>
      <UButton to="/app/bulk-scheduler" variant="ghost" icon="i-heroicons-arrow-left">
        {{ t('common.back') }}
      </UButton>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">{{ t('generate.templateConfig') }}</h2>
          </template>

          <div class="space-y-4">
            <UFormField :label="t('generate.businessId')" name="businessId">
              <USelectMenu v-model="selectedBusinessId" :options="businessOptions" value-attribute="value"
                option-attribute="label" class="w-full" :placeholder="t('generate.businessIdPlaceholder')" />
            </UFormField>

            <UFormField name="template">
              <template #label>
                <div class="flex items-center justify-between w-full">
                  <span class="text-sm font-medium">{{ t('generate.template') }}</span>
                  <TemplateVariablePopUp @action="handleVariableAction" />
                </div>
              </template>
              <UTextarea ref="templateTextarea" v-model="templateContent" :rows="6" class="w-full"
                :placeholder="t('generate.templatePlaceholder')" />
              <p class="text-xs text-gray-500 mt-1">{{ t('generate.templateHint') }}</p>
            </UFormField>

            <div v-if="detectTemplateVariables.length > 0" class="p-3 bg-blue-50 rounded-lg">
              <p class="text-sm font-medium text-blue-900">{{ t('generate.detectedVariables') }}</p>
              <div class="flex flex-wrap gap-2 mt-2">
                <span v-for="variable in detectTemplateVariables" :key="variable"
                  class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  {{ variable }}
                </span>
              </div>
            </div>

            <UFormField :label="t('generate.firstComment')" name="firstComment">
              <UInput v-model="firstComment" class="w-full" :placeholder="t('generate.firstCommentPlaceholder')" />
            </UFormField>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">{{ t('generate.customVariables') }}</h3>
              <UButton size="sm" icon="i-heroicons-plus" @click="addCustomVariable">
                {{ t('generate.addVariable') }}
              </UButton>
            </div>
          </template>

          <div class="space-y-3">
            <div v-for="(variable, index) in customVariables" :key="index" class="flex gap-2 items-start">
              <UInput v-model="variable.key" class="flex-1" placeholder="Variable name" />
              <UInput v-model="variable.value" class="flex-1" placeholder="Value" />
              <UButton icon="i-heroicons-x-mark" color="red" variant="ghost" size="sm" @click="removeVariable(index)" />
            </div>

            <p v-if="customVariables.length === 0" class="text-sm text-gray-500 text-center py-4">
              {{ t('generate.noCustomVariables') }}
            </p>
          </div>
        </UCard>
      </div>

      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">{{ t('generate.schedulingConfig') }}</h2>
          </template>

          <div class="space-y-4">
            <PlatformSelector :accounts="connectedSocialAccountsList" :selected-ids="selectedPlatforms" @toggle="(account) => {
              const index = selectedPlatforms.indexOf(account.id)
              if (index > -1) selectedPlatforms.splice(index, 1)
              else selectedPlatforms.push(account.id)
            }" />

            <UFormField :label="t('generate.dateRange')" name="dateRange">
              <DateRangeSelector @update="(r) => (dateRange = r)" />
            </UFormField>

            <UFormField :label="t('generate.postsPerDay')" name="postsPerDay">
              <UInput v-model.number="postsPerDay" type="number" :min="1" :max="10" class="w-full" />
            </UFormField>

            <div class="space-y-2">
              <UCheckbox v-model="skipWeekends" :label="t('generate.skipWeekends')" />
              <UCheckbox v-model="businessHoursOnly" :label="t('generate.businessHoursOnly')" />
            </div>
          </div>
        </UCard>

        <UButton block color="primary" size="lg" :disabled="!canGenerate || isLoading" :loading="isLoading"
          @click="handleGenerate">
          {{ t('generate.generatePosts') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
