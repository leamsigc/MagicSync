<i18n src="#site/app/pages/tools/og-image-generator/index.json"></i18n>

<script lang="ts" setup>
const props = defineProps<{
  modelValue: string
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <span v-if="label" class="text-xs text-muted">{{ label }}</span>
    <UPopover :content="{ align: 'end' }">
      <UButton
        variant="outline"
        color="neutral"
        size="sm"
        class="rounded-md"
        :aria-label="label || t('theme')"
        @click.prevent
      >
        <span class="size-4 rounded-sm ring-1 ring-white/20" :style="{ backgroundColor: modelValue }" />
        <span class="font-mono text-[10px] uppercase text-muted">{{ modelValue }}</span>
      </UButton>
      <template #content>
        <UColorPicker
          :model-value="modelValue"
          class="w-56"
          @update:model-value="(v: string) => emit('update:modelValue', v)"
        />
      </template>
    </UPopover>
  </div>
</template>
