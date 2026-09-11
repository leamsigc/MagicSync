<i18n src="../ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed } from 'vue';
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
  zoomPercent,
  editor,
  bgStatus,
  setPropertiesTab,
} = useFabricJs();

const { start: startAiModel } = useImageTransformer();

const showSaveAssetModal = ref(false);
const pendingDataUrl = ref<string | null>(null);
const pendingFilename = ref('');
const savedAssetId = ref<string | null>(null);

const hasSelection = computed(() => !!editor?.value?.activeLayer?.value);
const isAiError = computed(() => bgStatus.value === 'error');
const isAiReady = computed(() => bgStatus.value === 'loaded' || bgStatus.value === 'done');

const aiBadgeColor = computed(() => {
  if (isAiError.value) return 'error';
  if (isAiReady.value) return 'success';
  if (bgStatus.value === 'processing') return 'info';
  return 'warning';
});

const aiBadgeIcon = computed(() => {
  if (isAiError.value) return 'lucide:triangle-alert';
  if (isAiReady.value) return 'lucide:sparkles';
  return 'lucide:loader-circle';
});

const aiBadgeLabel = computed(() => {
  if (isAiError.value) return t('ai.statusError');
  if (isAiReady.value) return t('ai.statusReady');
  if (bgStatus.value === 'processing') return t('ai.statusProcessing');
  if (bgStatus.value === 'loading') return t('ai.statusLoading');
  return t('ai.statusIdle');
});

const aiBadgeHint = computed(() => {
  if (isAiError.value) return t('header.aiError');
  if (isAiReady.value) return t('header.aiReady');
  if (bgStatus.value === 'processing') return t('header.aiProcessing');
  return t('header.aiLoading');
});

const handleHomeClick = () => {
  navigateTo('/');
}

const handleRetryAi = async () => {
  if (bgStatus.value !== 'error') return;
  try {
    await startAiModel();
  } catch {
    showAiRetryFailed();
  }
};

const showAiRetryFailed = () => {
  toast.add({
    title: t('ai.errorTitle'),
    icon: 'i-heroicons-exclamation-triangle',
    color: 'error'
  });
};

const handleDuplicateSelection = () => {
  editor.value?.clone?.();
};

const handleDeleteSelection = () => {
  editor.value?.deleteLayer?.();
};

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

const handleExportClick = () => {
  setPropertiesTab('export');
};

</script>

<template>
  <header
    class="h-14 border-b border-default bg-default flex items-center justify-between px-3 gap-2 z-50">
    <!-- Left: back, doc title + AI status -->
    <div class="flex items-center gap-2 min-w-0">
      <UTooltip :text="t('header.back')">
        <UButton variant="ghost" color="neutral" icon="lucide:arrow-left" :aria-label="t('header.back')" @click="handleHomeClick" />
      </UTooltip>
      <span class="font-semibold text-sm hidden sm:block truncate">{{ t('header.docTitle') }}</span>

      <UTooltip :text="aiBadgeHint">
        <UBadge
          :color="aiBadgeColor" variant="soft" size="sm"
          :icon="aiBadgeIcon" data-testid="ai-status">
          {{ aiBadgeLabel }}
        </UBadge>
      </UTooltip>
      <UButton
        v-if="isAiError" variant="ghost" color="error" size="xs"
        icon="lucide:rotate-ccw" :label="t('ai.retry')"
        @click="handleRetryAi" />
    </div>

    <!-- Center: history + zoom -->
    <div class="flex items-center gap-1">
      <UTooltip :text="t('menu.vertical.undo')">
        <UButton variant="ghost" color="neutral" icon="lucide:undo" size="sm" :aria-label="t('menu.vertical.undo')" data-testid="btn-undo" @click="undo" />
      </UTooltip>
      <UTooltip :text="t('menu.vertical.redo')">
        <UButton variant="ghost" color="neutral" icon="lucide:redo" size="sm" :aria-label="t('menu.vertical.redo')" data-testid="btn-redo" @click="redo" />
      </UTooltip>

      <div
        v-if="hasSelection" v-motion-fade-visible :duration="200"
        class="flex items-center gap-1 ml-1 pl-2 border-l border-default">
        <UTooltip :text="t('header.duplicate')">
          <UButton variant="ghost" color="neutral" icon="lucide:copy-plus" size="sm" :aria-label="t('header.duplicate')" data-testid="btn-duplicate" @click="handleDuplicateSelection" />
        </UTooltip>
        <UTooltip :text="t('header.delete')">
          <UButton variant="ghost" color="error" icon="lucide:trash-2" size="sm" :aria-label="t('header.delete')" data-testid="btn-delete" @click="handleDeleteSelection" />
        </UTooltip>
      </div>

      <div class="hidden md:flex items-center gap-1 bg-muted rounded-lg p-0.5 ml-2">
        <UButton variant="ghost" color="neutral" icon="lucide:minus" size="xs" :aria-label="t('menu.vertical.zoomOut')" @click="zoomOut" />
        <span data-testid="zoom-level" class="text-xs font-mono w-12 text-center text-toned">{{ zoomPercent }}%</span>
        <UButton variant="ghost" color="neutral" icon="lucide:plus" size="xs" :aria-label="t('menu.vertical.zoomIn')" @click="zoomIn" />
      </div>
    </div>

    <!-- Right: actions -->
    <div class="flex items-center gap-2">
      <UButton
        v-if="savedAssetId"
        v-motion-fade-visible :duration="200"
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
        data-testid="btn-open-export" @click="handleExportClick" />
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
