<i18n src="../business.json"></i18n>
<script lang="ts" setup>
interface Tab {
  label: string
  value: string
  icon?: string
}

interface Props {
  tabs: Tab[]
  modelValue: string
}

interface Emits {
  'update:modelValue': [value: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedTab = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const handleTabClick = (tab: Tab) => {
  selectedTab.value = tab.value
}
</script>

<template>
  <div class="w-full">
    <!-- Tab Headers -->
    <div class="flex items-center  mb-6">
      <div class="flex items-center gap-1 p-1 rounded-xl ">
        <div v-for="tab in tabs" :key="tab.value"
          class="relative flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 min-w-[120px] justify-center"
          :class="[
            selectedTab === tab.value
              ? 'bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-neutral-50 font-medium'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-50/20 dark:hover:bg-neutral-800/20'
          ]" @click="handleTabClick(tab)">
          <UIcon v-if="tab.icon" :name="tab.icon" class="w-4 h-4" />
          <span class="text-sm">{{ tab.label }}</span>
        </div>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="animate-in fade-in duration-300">
      <slot :selectedTab="selectedTab" />
    </div>
  </div>
</template>
