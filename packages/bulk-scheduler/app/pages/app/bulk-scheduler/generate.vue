<!--  Translation file -->
<i18n src="./generate.json"></i18n>

<script lang="ts" setup>
import { useBusinessManager } from '#layers/BaseConnect/app/pages/app/business/composables/useBusinessManager'
import { useSocialMediaManager } from '#layers/BaseConnect/app/composables/UseSocialMediaManager'
import { extractVariablesFromTemplate } from '#layers/BaseBulkScheduler/utils/templateProcessor'
import { getDefaultSystemVariables } from '#layers/BaseBulkScheduler/utils/templateProcessor'
const { t } = useI18n()
const { generateBulkPosts, isLoading: isGenerating } = useBulkScheduler()
const { parseCsv, isLoading: isParsingCsv } = useCsvParser()
const toast = useToast()
const { businesses, activeBusinessId, getAllBusinesses } = useBusinessManager()
const { connectedSocialAccountsList, getAllSocialMediaAccounts } = useSocialMediaManager()
const router = useRouter()

const isLoading = computed(() => isGenerating.value || isParsingCsv.value)

const csvFileInput = ref<HTMLInputElement | null>(null)

const templateContent = ref('')
const customVariables = ref<{ name: string; label: string }[]>([])
const contentRows = ref<Record<string, string>[]>([{}])
const selectedPlatforms = ref<string[]>([])
const dateRange = ref<{ startDate: Date; endDate: Date }>({
  startDate: new Date(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
})
const selectedBusinessId = ref(activeBusinessId.value || '')
const skipWeekends = ref(false)
const businessHoursOnly = ref(false)
const firstComment = ref('')

const isVariableModalOpen = ref(false)
const editingVariableIndex = ref<number | null>(null)
const variableForm = ref({
  name: '',
  label: ''
})

const isRowModalOpen = ref(false)
const editingRowIndex = ref<number | null>(null)
const rowForm = ref<Record<string, string>>({})

const systemVariables = computed(() => getDefaultSystemVariables())

const templateTextarea = ref<HTMLTextAreaElement | null>(null)
const templateHintExample = '{{product_name}}'

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

const detectTemplateVariables = computed(() => {
  return extractVariablesFromTemplate(templateContent.value)
})

const openAddVariableModal = () => {
  editingVariableIndex.value = null
  variableForm.value = { name: '', label: '' }
  isVariableModalOpen.value = true
}

const openEditVariableModal = (index: number) => {
  editingVariableIndex.value = index
  const v = customVariables.value[index]
  if (!v) return
  variableForm.value = { ...v }
  isVariableModalOpen.value = true
}

const saveVariable = () => {
  if (!variableForm.value.name) return

  const v = { ...variableForm.value }
  v.name = v.name.trim().toLowerCase().replace(/\s+/g, '_')

  if (editingVariableIndex.value !== null) {
    const oldName = customVariables.value[editingVariableIndex.value]?.name || ''
    customVariables.value[editingVariableIndex.value] = v

    // Update data rows if name changed
    if (oldName !== v.name) {
      contentRows.value.forEach(row => {
        row[v.name] = row[oldName] || ''
        delete row[oldName]
      })
    }
  } else {
    // Check for duplicates
    if (customVariables.value.some(existing => existing.name === v.name)) {
      alert('Variable name already exists')
      return
    }
    customVariables.value.push(v)
    contentRows.value.forEach(row => {
      row[v.name] = ''
    })
  }

  isVariableModalOpen.value = false
}

const removeVariable = (index: number) => {
  const v = customVariables.value[index]
  if (!v) return
  customVariables.value.splice(index, 1)
  contentRows.value.forEach(row => {
    delete row[v.name]
  })
}

const openAddRowModal = () => {
  editingRowIndex.value = null
  const newRow: Record<string, string> = {}
  customVariables.value.forEach(v => (newRow[v.name] = ''))
  rowForm.value = newRow
  isRowModalOpen.value = true
}

const openEditRowModal = (index: number) => {
  editingRowIndex.value = index
  rowForm.value = { ...contentRows.value[index] }
  isRowModalOpen.value = true
}

const saveRow = () => {
  if (editingRowIndex.value !== null) {
    contentRows.value[editingRowIndex.value] = { ...rowForm.value }
  } else {
    contentRows.value.push({ ...rowForm.value })
  }
  isRowModalOpen.value = false
}

const removeRow = (index: number) => {
  contentRows.value.splice(index, 1)
}

const handleCsvImport = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const { variables, rows } = await parseCsv(file)

    // Replace or merge? I'll replace for now to keep it clean, or merge if they already have data.
    // Actually, user probably wants to replace if they are importing.
    // I'll show a confirm if they have data.
    if (customVariables.value.length > 0 || contentRows.value.length > 0) {
      if (!confirm('This will replace your current custom variables and rows. Continue?')) {
        return
      }
    }

    customVariables.value = variables
    contentRows.value = rows
    toast.add({ title: 'Success', description: `Imported ${rows.length} rows successfully`, color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  } finally {
    if (csvFileInput.value) csvFileInput.value.value = ''
  }
}

const triggerCsvImport = () => {
  csvFileInput.value?.click()
}

const handleVariableAction = (content: string) => {
  if (!templateTextarea.value) return

  const textarea = (templateTextarea.value as any)?.$el?.querySelector('textarea') || (templateTextarea.value as any)?.textarea
  const text = templateContent.value
  const start = textarea?.selectionStart ?? text.length
  const end = textarea?.selectionEnd ?? text.length

  templateContent.value = text.substring(0, start) + content + text.substring(end)

  nextTick(() => {
    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(start + content.length, start + content.length)
    }
  })
}

const canGenerate = computed(() => {
  return (
    templateContent.value.trim() !== '' &&
    selectedPlatforms.value.length > 0 &&
    selectedBusinessId.value.trim() !== '' &&
    contentRows.value.length > 0
  )
})

const handleGenerate = async () => {
  if (!canGenerate.value) return

  try {
    await generateBulkPosts({
      templateContent: templateContent.value,
      variables: customVariables.value.map(v => v.name),
      contentRows: contentRows.value,
      platforms: selectedPlatforms.value,
      businessId: selectedBusinessId.value,
      dateRange: dateRange.value,
      skipWeekends: skipWeekends.value,
      businessHoursOnly: businessHoursOnly.value,
      firstComment: firstComment.value || undefined
    })

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

    <!-- Data Table and Variables Grouped -->
    <UCard :ui="{ body: 'p-0' }">
      <template #header>
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-semibold">{{ t('generate.contentData') }}</h2>
              <p class="text-sm text-neutral-500">{{ t('generate.contentDataSubtitle') }}</p>
            </div>
            <div class="flex items-center gap-2">
              <UButton icon="i-heroicons-arrow-up-tray" color="neutral" variant="subtle" @click="triggerCsvImport">
                {{ t('generate.importCsv') }}
              </UButton>
              <UButton icon="i-heroicons-plus" color="primary" @click="openAddRowModal">{{ t('generate.addRow') }}
              </UButton>
            </div>
            <input ref="csvFileInput" type="file" accept=".csv" class="hidden" @change="handleCsvImport" />
          </div>

          <!-- Variables Toolbar -->
          <div class="flex flex-wrap items-center gap-3 p-3  rounded-lg">
            <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {{ t('generate.customVariablesTitle') }}
            </span>
            <div v-for="(v, i) in customVariables" :key="v.name"
              class="flex items-center gap-1 px-2 py-1  rounded-md group">
              <span class="text-sm font-medium text-neutral-700">{{ v.label || v.name }}</span>
              <div class="flex items-center  ml-1 pl-1">
                <UButton icon="i-heroicons-pencil-square" size="xs" variant="ghost" color="neutral" class="h-5 w-5 p-0"
                  @click="openEditVariableModal(i)" />
                <UButton icon="i-heroicons-trash" size="xs" variant="ghost" color="error" class="h-5 w-5 p-0"
                  @click="removeVariable(i)" />
              </div>
            </div>
            <UButton icon="i-heroicons-plus" size="xs" variant="subtle" color="neutral" @click="openAddVariableModal">
              {{ t('generate.newVariable') }}
            </UButton>
          </div>
        </div>
      </template>

      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left border-collapse">
          <thead>
            <tr class="">
              <th v-for="v in customVariables" :key="v.name" class="p-3 font-medium   first:border-l-0">
                <span class="capitalize">{{ v.label || v.name.replace(/_/g, ' ') }}</span>
              </th>
              <th class="p-3 w-20  ">{{ t('generate.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in contentRows" :key="rowIndex" class="">
              <td v-for="v in customVariables" :key="v.name" class="p-3  first:border-l-0">
                <span class="text-sm text-neutral-600">{{ row[v.name] || '-' }}</span>
              </td>
              <td class="p-2 text-center ">
                <div class="flex items-center justify-center gap-1">
                  <UButton icon="i-heroicons-pencil-square" size="xs" color="neutral" variant="ghost"
                    @click="openEditRowModal(rowIndex)" />
                  <UButton icon="i-heroicons-trash" size="xs" color="error" variant="ghost"
                    @click="removeRow(rowIndex)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="customVariables.length === 0" class="p-12 text-center  m-4 rounded-lg">
          <Icon name="i-heroicons-variable" class="w-10 h-10 mx-auto text-neutral-300 mb-3" />
          <h3 class="text-neutral-900 font-medium">{{ t('generate.noCustomVariables') }}</h3>
          <p class="text-sm text-neutral-500 mt-1 mb-4">{{ t('generate.noCustomVariablesSubtitle') }}
          </p>
          <UButton icon="i-heroicons-plus" @click="openAddVariableModal">{{ t('generate.addFirstVariable') }}</UButton>
        </div>
        <div v-else-if="contentRows.length === 0" class="p-12 text-center  m-4 rounded-lg">
          <Icon name="i-heroicons-table-cells" class="w-10 h-10 mx-auto text-neutral-300 mb-3" />
          <h3 class="text-neutral-900 font-medium">{{ t('generate.noContentRows') }}</h3>
          <p class="text-sm text-neutral-500 mt-1 mb-4">{{ t('generate.noContentRowsSubtitle') }}</p>
          <UButton icon="i-heroicons-plus" @click="openAddRowModal">{{ t('generate.addFirstRow') }}</UButton>
        </div>
      </div>
      <template #footer v-if="contentRows.length > 0">
        <div class="flex items-center justify-between">
          <p class="text-sm text-neutral-500">
            {{ t('generate.postsBatchInfo', { count: contentRows.length }) }}
          </p>
          <UButton v-if="customVariables.length > 0" icon="i-heroicons-plus" variant="subtle" size="sm"
            @click="openAddRowModal">
            {{ t('generate.addAnotherRow') }}</UButton>
        </div>
      </template>
    </UCard>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">{{ t('generate.templateEditor') }}</h2>
          </template>

          <div class="space-y-4">
            <UFormField :label="t('generate.businessId')" name="businessId">
              <USelectMenu v-model="selectedBusinessId" :options="businessOptions" value-attribute="value"
                option-attribute="label" class="w-full" :placeholder="t('generate.businessIdPlaceholder')" />
            </UFormField>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="block text-sm font-medium">{{ t('generate.templateContent') }}</label>
                <TemplateVariablePopUp @action="handleVariableAction" />
              </div>

              <div v-if="customVariables.length > 0 || systemVariables.length > 0"
                class="space-y-4 p-4 border border-neutral-200/10 rounded-lg">
                <div v-if="customVariables.length > 0">
                  <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500 block mb-2">
                    {{ t('generate.clickToInsert') }}</span>
                  <div class="flex flex-wrap gap-2">
                    <UBadge v-for="v in customVariables" :key="v.name" color="neutral" variant="subtle" size="sm"
                      class="cursor-pointer hover:bg-neutral-100 transition-colors"
                      @click="handleVariableAction(`{{${v.name}}}`)">
                      {{ v.label || v.name }}
                    </UBadge>
                  </div>
                </div>

                <div v-if="systemVariables.length > 0">
                  <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500 block mb-2">
                    {{ t('generate.systemVariables') }}:</span>
                  <div class="flex flex-wrap gap-2">
                    <UBadge v-for="v in systemVariables" :key="v.key" color="primary" variant="subtle" size="sm"
                      class="cursor-pointer hover:bg-primary-50 transition-colors"
                      @click="handleVariableAction(`{{${v.key}}}`)">
                      {{ v.key }}
                    </UBadge>
                  </div>
                </div>
              </div>

              <UTextarea ref="templateTextarea" v-model="templateContent"
                :placeholder="t('generate.template.placeholder')" class="w-full font-mono text-base" :rows="8" />
              <p class="text-xs text-gray-400 italic">
                {{ t('generate.templateHint', { example: templateHintExample }) }}
              </p>
            </div>

            <UFormField :label="t('generate.firstComment')" name="firstComment">
              <UInput v-model="firstComment" :placeholder="t('generate.firstCommentPlaceholder')" class="w-full" />
            </UFormField>
          </div>
        </UCard>
      </div>

      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">{{ t('generate.scheduling') }}</h2>
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

            <div class="space-y-3 pt-2">
              <UCheckbox v-model="skipWeekends" :label="t('generate.skipWeekends')" />
              <UCheckbox v-model="businessHoursOnly" :label="t('generate.businessHoursOnly')" />
            </div>

            <div class="pt-4 border-t border-zinc-100">
              <div class="flex items-center justify-between mb-4">
                <span class="text-sm font-medium">{{ t('generate.readyToPost') }}</span>
                <span class="text-lg font-bold text-primary">{{ contentRows.length }} {{ t('generate.items') }}</span>
              </div>

              <UButton color="primary" block size="lg" :loading="isLoading" :disabled="!canGenerate"
                @click="handleGenerate">
                {{ t('generate.submit') }}
              </UButton>
            </div>
          </div>
        </UCard>

        <BulkPostPreview :template="templateContent" :content-rows="contentRows" :platforms="selectedPlatforms"
          :date-range="dateRange" :skip-weekends="skipWeekends" :business-hours-only="businessHoursOnly" />
      </div>
    </div>

    <!-- Variable Management Modal -->
    <UModal v-model:open="isVariableModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold">
                {{ editingVariableIndex !== null ? t('generate.editVariable') : t('generate.addCustomVariable') }}
              </h3>
              <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" @click="isVariableModalOpen = false" />
            </div>
          </template>

          <UForm :state="variableForm" class="space-y-4" @submit="saveVariable">
            <UFormField :label="t('generate.variableNameLabel')" name="name" required
              :help="t('generate.variableNameHelp')">
              <UInput v-model="variableForm.name" :placeholder="t('generate.variableNamePlaceholder')" />
            </UFormField>

            <UFormField :label="t('generate.displayLabel')" name="label" required
              :help="t('generate.displayLabelHelp')">
              <UInput v-model="variableForm.label" :placeholder="t('generate.displayLabelPlaceholder')" />
            </UFormField>

            <div class="flex justify-end gap-3 pt-4">
              <UButton color="neutral" variant="ghost" @click="isVariableModalOpen = false">{{ t('generate.cancel') }}
              </UButton>
              <UButton type="submit" color="primary">
                {{ editingVariableIndex !== null ? t('generate.updateVariable') : t('generate.addVariable') }}
              </UButton>
            </div>
          </UForm>
        </UCard>
      </template>
    </UModal>

    <!-- Row Management Modal -->
    <UModal v-model:open="isRowModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold">
                {{ editingRowIndex !== null ? t('generate.editContentRow') : t('generate.addContentRow') }}
              </h3>
              <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" @click="isRowModalOpen = false" />
            </div>
          </template>

          <UForm :state="rowForm" class="space-y-4" @submit="saveRow">
            <UFormField v-for="v in customVariables" :key="v.name" :label="v.label || v.name" :name="v.name">
              <UTextarea v-model="rowForm[v.name]"
                :placeholder="t('generate.enterValueFor', { name: v.label || v.name })" autoresize :rows="4" />
            </UFormField>

            <div v-if="customVariables.length === 0" class="text-center py-4 text-neutral-500">
              {{ t('generate.addVariableFirst') }}
            </div>

            <div class="flex justify-end gap-3 pt-4">
              <UButton color="neutral" variant="ghost" @click="isRowModalOpen = false">{{ t('generate.cancel') }}
              </UButton>
              <UButton type="submit" color="primary" :disabled="customVariables.length === 0">
                {{ editingRowIndex !== null ? t('generate.updateRow') : t('generate.addRow') }}
              </UButton>
            </div>
          </UForm>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
