<script lang="ts" setup>
/**
 * Component Description: Variable PopUp for content editor
 */

const { getTemplatesByType, templateList, isLoading, createTemplate, updateTemplate, deleteTemplate } = useTemplateManager()
const TEMPLATE_TYPE = 'VARIABLE' as const
onMounted(() => {
  getTemplatesByType(TEMPLATE_TYPE)
})
const emit = defineEmits(['action']);

const items = computed(() => {
  return [
    [
      {
        label: 'System Variables',
        icon: 'i-lucide-user',
        children: [
          { label: 'Current Date', onSelect: () => emit('action', '{{date}}') },
          { label: 'Current Time', onSelect: () => emit('action', '{{time}}') },
          { label: 'Current Day', onSelect: () => emit('action', '{{day}}') },
          { label: 'Current Month', onSelect: () => emit('action', '{{month}}') },
          { label: 'Current Year', onSelect: () => emit('action', '{{year}}') }
        ]
      }
    ],

    templateList.value[TEMPLATE_TYPE]?.map((template) => {
      return {
        label: template.title,
        onSelect: () => emit('action', template.content)
      }
    })]
})
</script>

<template>
  <UDropdownMenu :items="items" :popper="{ placement: 'top-start' }">
    <UButton :loading="isLoading" variant="ghost"
      class="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
      <Icon name="lucide:braces" class="w-5 h-5" />
    </UButton>
  </UDropdownMenu>
</template>
