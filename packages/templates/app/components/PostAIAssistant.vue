<script lang="ts" setup>
/**
 * Component Description: AI Assistant dropdown menu and actions
 */

interface Props {
  loading?: boolean;
}
const { getTemplatesByType, templateList, isLoading, createTemplate, updateTemplate, deleteTemplate } = useTemplateManager()
const TEMPLATE_TYPE = 'CHAT' as const
onMounted(() => {
  getTemplatesByType(TEMPLATE_TYPE)
})

const props = defineProps<Props>();
const emit = defineEmits(['action', 'template-action', 'custom-prompt']);

const isModalOpen = ref(false)
const input = ref('')
const chat = ref({ error: undefined as Error | undefined })

const onSubmit = (): void => {
  console.log("Value", input.value);

  emit('action', 'custom-prompt', input.value)
  isModalOpen.value = false
  input.value = ''
}

// Available rewrite tones matching backend schedulerGeneratePrompts.ts
const availableTones = [
  { value: 'professional', label: 'Professional', icon: 'lucide:briefcase', description: 'Authority + warmth' },
  { value: 'casual', label: 'Casual', icon: 'lucide:message-circle', description: 'Like texting a friend' },
  { value: 'witty', label: 'Witty', icon: 'lucide:zap', description: 'Clever + valuable' },
  { value: 'inspirational', label: 'Inspirational', icon: 'lucide:rocket', description: 'Uplifting + specific' },
  { value: 'direct', label: 'Direct', icon: 'lucide:arrow-right', description: 'No fluff, straight to value' },
  { value: 'angry', label: 'Passionate', icon: 'lucide:flame', description: 'Righteous frustration → action' },
  { value: 'clickbait', label: 'Click-worthy', icon: 'lucide:mouse-pointer', description: 'Promise delivers' },
  { value: 'humorous', label: 'Humorous', icon: 'lucide:smile', description: 'Funny + useful' },
  { value: 'educational', label: 'Educational', icon: 'lucide:graduation-cap', description: 'Step-by-step clarity' },
  { value: 'empathetic', label: 'Empathetic', icon: 'lucide:heart', description: 'I\'ve been there' },
  { value: 'controversial', label: 'Bold Take', icon: 'lucide:alert-triangle', description: 'Spark discussion' },
  { value: 'exciting', label: 'Exciting', icon: 'lucide:bolt', description: 'Energy + evidence' },
  { value: 'urgent', label: 'Urgent', icon: 'lucide:clock', description: 'Act now' },
]

const aiActions = computed(() => [
  [
    {
      label: 'Custom Prompt',
      slot: 'custom-prompt' as const,
      onSelect: () => {
        isModalOpen.value = true
      }
    }
  ],
  [
    {
      label: 'Tones',
      icon: 'i-lucide-user-plus',
      children:
        availableTones.map(tone => ({
          label: tone.label,
          description: tone.description,
          icon: tone.icon,
          onSelect: () => emit('action', `rewrite-${tone.value}`)
        })),
    }
  ],
  // Rewrite tones as individual items
  [
    {
      label: 'Fix Grammar',
      icon: 'lucide:check-check',
      onSelect: () => emit('action', 'fix-grammar')
    },
    {
      label: 'Generate Hashtags',
      icon: 'lucide:hash',
      onSelect: () => emit('action', 'generate-hashtags')
    }
  ],
  [
    {
      label: 'Smart Split (Auto Thread)',
      icon: 'lucide:scissors',
      onSelect: () => emit('action', 'smart-split')
    }
  ],
  templateList.value[TEMPLATE_TYPE]?.map((template) => {
    return {
      label: template.title,
      onSelect: () => emit('template-action', template.content)
    }
  })
])
</script>

<template>
  <UDropdownMenu :items="aiActions" :popper="{ placement: 'bottom-start' }" trigger="click" class="max-h-52">
    <UButton
      class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-500/20"
      icon="lucide:wand-2" :loading="loading" variant="ghost">
      <span class="text-sm font-medium hidden md:block">AI Tools</span>
    </UButton>
  </UDropdownMenu>

  <UModal v-model:open="isModalOpen">
    <template #content>
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">Custom Prompt</h3>
        <UChatPrompt v-model="input" icon="i-lucide-search" variant="outline" :error="chat.error" @submit="onSubmit" />
      </div>
    </template>
  </UModal>
</template>
