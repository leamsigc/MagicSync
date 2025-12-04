<script lang="ts" setup>
import type { PlatformConfig } from '#layers/BaseScheduler/shared/platformConstants';

/**
 * Component Description: Tabs for switching between Master content and platform-specific overrides
 */

interface Tab {
  label: string;
  value: string;
  icon?: string;
  disabled?: boolean;
}

interface Props {
  modelValue: string; // active context
  tabs: Tab[];
  currentPlatformConfig: PlatformConfig;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:modelValue']);

const selectTab = (value: string) => {
  emit('update:modelValue', value);
};
</script>

<template>
  <div class="flex items-center gap-1 p-1 bg-zinc-900/50 rounded-lg border border-zinc-800/50 w-fit">
    <UButton v-for="tab in tabs" :key="tab.value" @click="selectTab(tab.value)" variant="ghost"
      class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all border" :class="[
        modelValue === tab.value
          ? 'bg-zinc-800 text-white shadow-sm'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
      ]" :disabled="tab.disabled"
      :style="{ borderColor: tab.value === modelValue ? props.currentPlatformConfig.color : 'transparent' }">
      <Icon v-if="tab.icon" :name="tab.icon" class="w-4 h-4" />
      {{ tab.label }}
    </UButton>
  </div>
</template>
