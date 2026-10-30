<i18n src="./BaseCollection.json"></i18n>
<script lang="ts" setup>
/**
 * Grid / List / Table (or any other) view switcher used by every collection
 * toolbar. Hidden when a surface only has one meaningful view.
 */
import type { CollectionViewOption } from '../utils/collection'

interface Props {
  modelValue?: string
  options: CollectionViewOption[]
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()

function handleSelect(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div v-if="props.options.length > 1" class="flex items-center gap-1" role="group" :aria-label="t('view_group_label')">
    <UButton
      v-for="option in props.options"
      :key="option.value"
      :icon="option.icon"
      :label="option.label"
      :variant="props.modelValue === option.value ? 'solid' : 'ghost'"
      :color="props.modelValue === option.value ? 'primary' : 'neutral'"
      size="sm"
      class="rounded-xl"
      :aria-pressed="props.modelValue === option.value"
      :disabled="props.disabled"
      @click="() => handleSelect(option.value)"
    />
  </div>
</template>
