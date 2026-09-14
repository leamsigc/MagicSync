<i18n src="../business.json"></i18n>
<script lang="ts" setup>
import type { Step } from './MultiStepLoader.vue'
import MultiStepLoader from './MultiStepLoader.vue'

interface Props {
  steps: Step[]
  loading: boolean
  visible: boolean
  /** Backend-driven active step index (null = timer mode) */
  activeStep?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  activeStep: null
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  close: []
}>()

const { t } = useI18n()

const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const handleClose = () => {
  isVisible.value = false
  emit('close')
}
</script>

<template>
  <UModal v-model:open="isVisible" :overlay="true" class="items-start min-h-[500px] grid grid-cols-1 content-center"
    :ui="{ content: 'min-w-5xl min-h-[90vh] grid grid-cols-1 content-center' }">
    <div class="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-lg mx-auto w-full">
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
          {{ t('wizard.title') }}
        </h2>
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ t('wizard.subtitle_step2') }}
        </p>
      </div>
    </div>
    <template #content>
      <MultiStepLoader :steps="steps" :loading="loading" :active-step="activeStep" @close="handleClose" />
    </template>

  </UModal>
</template>
