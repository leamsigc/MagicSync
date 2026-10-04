<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>
<script lang="ts" setup>
import { computed } from 'vue';
import { CorePlugin } from '../../../composables/tools/image-editor/editor/CorePlugin';
import { HooksPlugin } from '../../../composables/tools/image-editor/editor/HooksPlugin';
import { HistoryPlugin } from '../../../composables/tools/image-editor/editor/plugins/HistoryPlugin';
import { AlignPlugin } from '../../../composables/tools/image-editor/editor/plugins/AlignPlugin';
import { WorkspacePlugin } from '../../../composables/tools/image-editor/editor/plugins/WorkspacePlugin';
import { LayerPlugin } from '../../../composables/tools/image-editor/editor/plugins/LayerPlugin';
import { AddBaseTypePlugin } from '../../../composables/tools/image-editor/editor/plugins/AddBaseTypePlugin';
import { FontPlugin } from '../../../composables/tools/image-editor/editor/plugins/FontPlugin';
import { FilterPlugin } from '../../../composables/tools/image-editor/editor/plugins/FilterPlugin';
import { ShadowPlugin } from '../../../composables/tools/image-editor/editor/plugins/ShadowPlugin';
import { DrawPlugin } from '../../../composables/tools/image-editor/editor/plugins/DrawPlugin';
import { ExportPlugin } from '../../../composables/tools/image-editor/editor/plugins/ExportPlugin';
import { ClipboardPlugin } from '../../../composables/tools/image-editor/editor/plugins/ClipboardPlugin';
import { HotkeyPlugin } from '../../../composables/tools/image-editor/editor/plugins/HotkeyPlugin';
import { GroupPlugin } from '../../../composables/tools/image-editor/editor/plugins/GroupPlugin';
import { LockPlugin } from '../../../composables/tools/image-editor/editor/plugins/LockPlugin';
import { RulerPlugin } from '../../../composables/tools/image-editor/editor/plugins/RulerPlugin';
import { TransformPlugin } from '../../../composables/tools/image-editor/editor/plugins/TransformPlugin';
import { ToolsPlugin } from '../../../composables/tools/image-editor/editor/ToolsPlugin';
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs';

const { t } = useI18n();
const toast = useToast();
const { run, editor, bgStatus, bgProgress } = useFabricJs();
const canvas = useTemplateRef('canvas');
const route = useRoute();

const isAiBusy = computed(() => bgStatus.value === 'loading' || bgStatus.value === 'processing');
const aiOverlayLabel = computed(() => {
  const progress = Math.round(bgProgress.value);
  if (bgStatus.value === 'processing') return t('canvas.aiWorking', { progress });
  return t('canvas.aiLoading', { progress });
});

onMounted(async () => {
  if (editor.value) {
    // If already initialized (hm, unlikely with run pattern but safe check)
  }

  run(canvas, [
    CorePlugin,
    ToolsPlugin,
    HooksPlugin,
    HistoryPlugin,
    AlignPlugin,
    WorkspacePlugin,
    LayerPlugin,
    AddBaseTypePlugin,
    FontPlugin,
    FilterPlugin,
    ShadowPlugin,
    DrawPlugin,
    ExportPlugin,
    ClipboardPlugin,
    HotkeyPlugin,
    GroupPlugin,
    LockPlugin,
    RulerPlugin,
    TransformPlugin
  ]);

  // Note: the AI model preload lives in ImageEditorProperties (single
  // idempotent start()) — the status pill below reflects shared state.

  // Handle query param image
  const imageId = route.query.imageId as string;
  if (imageId) {
    try {
      const url = `/api/v1/assets/serve/${imageId}.png`;
      // We can directly add it via URL
      // But checking validity first is good practice
      const response = await fetch(url);
      if (response.ok) {
        editor.value?.addImageLayerFromUrl(url);
      }
    } catch {
      showImageLoadFailed();
    }
  }

});

const showImageLoadFailed = () => {
  toast.add({
    title: t('ai.errFailed'),
    icon: 'i-heroicons-exclamation-triangle',
    color: 'warning'
  });
};

// Handle Drag and Drop on the workspace to add images
const onDrop = (e: DragEvent) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  if (isSupportedDrop(file)) {
    editor.value?.addImageLayer(file);
  } else {
    showDropRejected();
  }
};

const isSupportedDrop = (file: File) => file.type.startsWith('image/');

const showDropRejected = () => {
  toast.add({
    title: t('panel.uploadsInvalid'),
    icon: 'i-heroicons-exclamation-triangle',
    color: 'warning'
  });
};
</script>

<template>
  <div
    id="workspace"
    class="canvas-dots flex-1 overflow-hidden bg-muted relative flex items-center justify-center"
    @dragover.prevent @drop="onDrop">
    <div class="canvas-box shadow-2xl">
      <canvas ref="canvas" class="editor" />
    </div>

    <!-- Floating AI status pill -->
    <div
      v-if="isAiBusy"
      v-motion-fade-visible :duration="250"
      data-testid="canvas-ai-status"
      class="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2.5 rounded-full border border-default bg-elevated/90 backdrop-blur-md px-4 py-2 shadow-lg">
      <Icon name="svg-spinners:270-ring-with-bg" class="w-4 h-4 shrink-0 text-primary" />
      <span class="text-xs font-medium whitespace-nowrap">{{ aiOverlayLabel }}</span>
      <UProgress :model-value="bgProgress" :max="100" size="xs" class="w-24" />
    </div>
  </div>
</template>

<style scoped>
.canvas-dots {
  background-image: radial-gradient(color-mix(in srgb, currentColor 14%, transparent) 1px, transparent 1px);
  background-size: 22px 22px;
  color: var(--ui-text-dimmed, #a8a8a8);
}

.canvas-box {
  position: relative;
  /* initial shadow or border can go here */
}

/*
   Fabric canvas wrapper usually gets set by the library,
   but we ensure the container centers it.
*/

.editor {
  background-color: white;
  /* Default canvas color */
  /* Checkerboard pattern for transparency indication */
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}
</style>
