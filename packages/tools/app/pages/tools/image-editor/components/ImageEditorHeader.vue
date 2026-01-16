<i18n src="../ImageEditor.json"></i18n>

<script lang="ts" setup>
import { useFabricJs } from '../composables/useFabricJs';

// Props
defineProps<{
  // Add any props if needed later
}>();

const { t } = useI18n();
const { 
  undo, 
  redo, 
  zoomIn, 
  zoomOut, 
  downloadCanvasImage, 
  exportCurrentCanvas,
  editor 
} = useFabricJs();

const canvasZoom = computed(() => {
  return Math.round((editor.value?.fabricCanvas?.getZoom() || 1) * 100);
});

const handleHomeClick = () => {
    navigateTo('/');
}

</script>

<template>
  <header class="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-4 z-50">
    <!-- Left: Logo & File Actions -->
    <div class="flex items-center gap-4">
      <UButton variant="ghost" color="neutral" icon="lucide:arrow-left" @click="handleHomeClick" />
      <span class="font-semibold text-sm hidden sm:block">Image Editor</span>
      
      <div class="h-4 w-[1px] bg-gray-300 dark:bg-gray-700 mx-2"></div>
      
      <!-- History Controls -->
      <UTooltip :text="t('menu.vertical.undo', 'Undo')">
        <UButton variant="ghost" color="neutral" icon="lucide:undo" size="sm" @click="undo" />
      </UTooltip>
      <UTooltip :text="t('menu.vertical.redo', 'Redo')">
        <UButton variant="ghost" color="neutral" icon="lucide:redo" size="sm" @click="redo" />
      </UTooltip>
    </div>

    <!-- Center: Zoom Controls -->
    <div class="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-md p-1">
      <UButton variant="ghost" color="neutral" icon="lucide:minus" size="xs" @click="zoomOut" />
      <span class="text-xs font-mono w-12 text-center">{{ canvasZoom }}%</span>
      <UButton variant="ghost" color="neutral" icon="lucide:plus" size="xs" @click="zoomIn" />
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-2">
      <UButton 
        color="neutral" 
        variant="outline" 
        size="sm" 
        icon="lucide:download" 
        :label="t('menu.main.save', 'Save')" 
        @click="downloadCanvasImage" 
      />
      <UButton 
        color="primary" 
        variant="solid" 
        size="sm" 
        icon="lucide:share" 
        :label="t('menu.main.export', 'Export')" 
        @click="exportCurrentCanvas" 
      />
    </div>
  </header>
</template>

<style scoped>
</style>
