<i18n src="./AiCsvGeneratorModal.json"></i18n>

<script lang="ts" setup>
import { getDefaultSystemVariables } from '#layers/BaseBulkScheduler/utils/templateProcessor'
import type { Template } from '#layers/BaseDB/db/schema'

export interface CsvRowData {
  content: string
  image_url: string
  scheduled_time: string
  comments: string
}

const emit = defineEmits<{
  generated: [rows: CsvRowData[]]
  close: []
}>()

const { t } = useI18n()
const toast = useToast()
const prompt = ref('')
const isGenerating = ref(false)
const customVariables = ref<{ name: string; label: string }[]>([])
const showNewVariable = ref(false)
const newVariableName = ref('')
const promptTextarea = ref<HTMLTextAreaElement | null>(null)
const templatesByType = ref<Record<string, Template[]>>({})
const templatesLoading = ref(false)

const systemVariables = computed(() => getDefaultSystemVariables())

onMounted(async () => {
  templatesLoading.value = true
  try {
    const types = ['VARIABLE', 'CHAT', 'EMAIL', 'IMAGES']
    const results = await Promise.allSettled(
      types.map(type =>
        $fetch<{ data: Template[] }>(`/api/v1/templates?type=${type}&limit=50`)
      )
    )
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        const type = types[i]
        if (type) {
          templatesByType.value[type] = result.value.data
        }
      }
    })
  } finally {
    templatesLoading.value = false
  }
})

const insertAtCursor = (text: string) => {
  if (!promptTextarea.value) return
  const textarea = promptTextarea.value
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = prompt.value.substring(0, start)
  const after = prompt.value.substring(end)
  prompt.value = before + text + after
  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(start + text.length, start + text.length)
  })
}

const addCustomVariable = () => {
  const name = newVariableName.value.trim().toLowerCase().replace(/\s+/g, '_')
  if (!name) return
  if (customVariables.value.some(v => v.name === name)) return
  customVariables.value.push({ name, label: name.replace(/_/g, ' ') })
  newVariableName.value = ''
  showNewVariable.value = false
}

const removeCustomVariable = (index: number) => {
  customVariables.value.splice(index, 1)
}

const dropdownItems = computed(() => {
  const items: any[] = []

  const systemChildren = systemVariables.value.map(sv => ({
    label: `${sv.key} — ${sv.description || ''}`,
    onSelect: () => insertAtCursor(`{{${sv.key}}}`)
  }))
  if (systemChildren.length > 0) {
    items.push({
      label: t('aiCsvGenerator.systemVariables'),
      icon: 'i-lucide-user',
      children: systemChildren
    })
  }

  for (const type of ['VARIABLE', 'CHAT', 'EMAIL', 'IMAGES']) {
    const templates = templatesByType.value[type]
    if (templates && templates.length > 0) {
      items.push({
        label: `${type} Templates`,
        icon: 'i-lucide-file-text',
        children: templates.map(t => ({
          label: t.title,
          onSelect: () => insertAtCursor(t.content)
        }))
      })
    }
  }

  return items
})

const handleGenerate = async () => {
  if (!prompt.value.trim()) return

  isGenerating.value = true
  try {
    const variablesInfo = customVariables.value.map(v => ({
      name: v.name,
      label: v.label
    }))

    const response = await $fetch<{ result: Array<Record<string, string>> }>('/api/v1/ai/generate', {
      method: 'POST',
      body: {
        action: 'generateCsv',
        content: JSON.stringify({
          prompt: prompt.value,
          variables: variablesInfo,
          systemVariables: systemVariables.value.map(v => v.key)
        })
      }
    })

    const rows = response.result.map((item: any) => ({
      content: item.content || '',
      image_url: item.image_url || '',
      scheduled_time: item.scheduled_time || '',
      comments: item.comments || ''
    }))

    if (rows.length === 0) {
      toast.add({
        title: t('aiCsvGenerator.noPostsGenerated'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'warning'
      })
      return
    }

    toast.add({
      title: t('aiCsvGenerator.generated', { count: rows.length }),
      icon: 'i-heroicons-check-circle',
      color: 'success'
    })

    emit('generated', rows)
  } catch (err: any) {
    toast.add({
      title: t('aiCsvGenerator.error'),
      description: err.message || t('aiCsvGenerator.errorDescription'),
      icon: 'i-heroicons-x-circle',
      color: 'error'
    })
  } finally {
    isGenerating.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold">{{ t('aiCsvGenerator.title') }}</h3>
        <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" @click="$emit('close')" />
      </div>
    </template>

    <div class="space-y-4">
      <p class="text-sm text-gray-600">{{ t('aiCsvGenerator.description') }}</p>

      <UFormField :label="t('aiCsvGenerator.promptLabel')" name="prompt" required>
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <UDropdownMenu v-if="dropdownItems.length > 0" :items="dropdownItems"
              :popper="{ placement: 'bottom-start' }">
              <UButton :loading="templatesLoading" variant="ghost" size="xs" color="neutral" icon="i-lucide-braces"
                :label="t('aiCsvGenerator.insertVariable')" />
            </UDropdownMenu>
          </div>
          <UTextarea ref="promptTextarea" v-model="prompt" :placeholder="t('aiCsvGenerator.promptPlaceholder')"
            class="w-full" :rows="5" autoresize />
        </div>
      </UFormField>

      <!-- Custom Variables -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">{{ t('aiCsvGenerator.customVariables') }}</span>
          <UButton v-if="!showNewVariable" icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost"
            @click="showNewVariable = true">
            {{ t('aiCsvGenerator.addVariable') }}
          </UButton>
        </div>

        <div v-if="showNewVariable" class="flex items-center gap-2">
          <UInput v-model="newVariableName" size="sm" :placeholder="t('aiCsvGenerator.variableNamePlaceholder')"
            class="flex-1" @keyup.enter="addCustomVariable" />
          <UButton icon="i-heroicons-check" size="xs" color="primary" variant="solid" @click="addCustomVariable" />
          <UButton icon="i-heroicons-x-mark" size="xs" color="neutral" variant="ghost"
            @click="showNewVariable = false" />
        </div>

        <div v-if="customVariables.length > 0" class="flex flex-wrap gap-2">
          <UBadge v-for="(v, i) in customVariables" :key="v.name" color="neutral" variant="subtle" size="sm"
            class="flex items-center gap-1 cursor-default">
            <span @click="insertAtCursor(`{{${v.name}}}`)">{{ v.label || v.name }}</span>
            <UButton icon="i-heroicons-x-mark" size="sm" color="error" variant="ghost" class="h-3 w-3 p-0"
              @click="removeCustomVariable(i)" />
          </UBadge>
        </div>

        <p v-if="!showNewVariable && customVariables.length === 0" class="text-xs text-gray-400">
          {{ t('aiCsvGenerator.noVariables') }}
        </p>
      </div>

      <p class="text-xs text-gray-400">{{ t('aiCsvGenerator.hint') }}</p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton color="neutral" variant="ghost" @click="$emit('close')">
          {{ t('common.cancel') }}
        </UButton>
        <UButton color="primary" :loading="isGenerating" :disabled="!prompt.trim()" @click="handleGenerate">
          {{ t('aiCsvGenerator.generate') }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>
