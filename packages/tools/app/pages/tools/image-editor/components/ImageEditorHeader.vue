<i18n src="../ImageEditor.json"></i18n>

<script lang="ts" setup>
import { useFabricJs } from '../composables/useFabricJs';

const { t } = useI18n();
const toast = useToast();
const {
  undo,
  redo,
  zoomIn,
  zoomOut,
  downloadCanvasImage,
  getFrameDataUrl,
  exportCurrentCanvas,
  zoomPercent
} = useFabricJs();

const showSaveAssetModal = ref(false);
const pendingDataUrl = ref<string | null>(null);
const pendingFilename = ref('');
const savedAssetId = ref<string | null>(null);

const handleHomeClick = () => {
  navigateTo('/');
}

const handleSaveToLibrary = () => {
  const dataUrl = getFrameDataUrl();
  if (!dataUrl) {
    toast.add({
      title: t('notifications.frameUnavailable'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'warning'
    });
    return;
  }
  pendingDataUrl.value = dataUrl;
  pendingFilename.value = `magic_sync_design_${Date.now()}.png`;
  showSaveAssetModal.value = true;
};

const handleSaved = (asset: { id: string }) => {
  savedAssetId.value = asset.id;
};

const handleUseInPost = () => {
  if (!savedAssetId.value) return;
  sessionStorage.setItem('video-cropper-media', JSON.stringify({ assetId: savedAssetId.value, source: 'image-editor' }));
  navigateTo('/app/posts/new');
};

</script>

<template>
  <header
    class="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-4 z-50">
    <!-- Left: Logo & File Actions -->
    <div class="flex items-center gap-4">
      <UButton variant="ghost" color="neutral" icon="lucide:arrow-left" @click="handleHomeClick" />
      <span class="font-semibold text-sm hidden sm:block">Image Editor</span>

      <div class="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-2"/>

      <!-- History Controls -->
      <UTooltip :text="t('menu.vertical.undo', 'Undo')">
        <UButton variant="ghost" color="neutral" icon="lucide:undo" size="sm" aria-label="Undo" data-testid="btn-undo" @click="undo" />
      </UTooltip>
      <UTooltip :text="t('menu.vertical.redo', 'Redo')">
        <UButton variant="ghost" color="neutral" icon="lucide:redo" size="sm" aria-label="Redo" data-testid="btn-redo" @click="redo" />
      </UTooltip>
    </div>

    <!-- Center: Zoom Controls -->
    <div class="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-md p-1">
      <UButton variant="ghost" color="neutral" icon="lucide:minus" size="xs" aria-label="Zoom Out" @click="zoomOut" />
      <span data-testid="zoom-level" class="text-xs font-mono w-12 text-center">{{ zoomPercent }}%</span>
      <UButton variant="ghost" color="neutral" icon="lucide:plus" size="xs" aria-label="Zoom In" @click="zoomIn" />
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-2">
      <UButton
        v-if="savedAssetId"
        color="primary" variant="soft" size="sm" icon="lucide:calendar-plus"
        :label="t('menu.main.useInPost', 'Use in Post')"
        data-testid="btn-use-in-post"
        @click="handleUseInPost" />
      <UButton
        color="neutral" variant="outline" size="sm" icon="lucide:download" :label="t('menu.main.save', 'Save')"
        @click="downloadCanvasImage" />
      <UButton
        color="neutral" variant="outline" size="sm" icon="lucide:library-big"
        :label="t('menu.main.saveToLibrary', 'Save to Library')"
        data-testid="btn-save-to-library"
        @click="handleSaveToLibrary" />
      <UButton
        color="primary" variant="solid" size="sm" icon="lucide:share" :label="t('menu.main.export', 'Export')"
        @click="exportCurrentCanvas" />
    </div>

    <BaseSaveAssetModal
      v-model:open="showSaveAssetModal"
      accept="dataUrl"
      :filename="pendingFilename"
      :payload="pendingDataUrl"
      @saved="handleSaved"
    />
  </header>
</template>

<style scoped></style>
