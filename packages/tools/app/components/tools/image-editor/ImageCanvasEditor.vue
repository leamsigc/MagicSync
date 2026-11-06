<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>
<script lang="ts" setup>
import { computed, onUnmounted } from 'vue';
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
import { AlignGuidelinePlugin } from '../../../composables/tools/image-editor/editor/plugins/AlignGuidelinePlugin';
import { MiddleMousePlugin } from '../../../composables/tools/image-editor/editor/plugins/MiddleMousePlugin';
import { WatermarkPlugin } from '../../../composables/tools/image-editor/editor/plugins/WatermarkPlugin';
import { QrCodePlugin } from '../../../composables/tools/image-editor/editor/plugins/QrCodePlugin';
import { SimpleClipImagePlugin } from '../../../composables/tools/image-editor/editor/plugins/SimpleClipImagePlugin';
import { TransformPlugin } from '../../../composables/tools/image-editor/editor/plugins/TransformPlugin';
import { ToolsPlugin } from '../../../composables/tools/image-editor/editor/ToolsPlugin';
import { StudioPlugin } from '../../../composables/tools/image-editor/editor/plugins/StudioPlugin';
import { AnimationPlugin } from '../../../composables/tools/image-editor/editor/plugins/AnimationPlugin';
import { ResizePlugin } from '../../../composables/tools/image-editor/editor/plugins/ResizePlugin';
import { TouchPlugin } from '../../../composables/tools/image-editor/editor/plugins/TouchPlugin';
import { VideoPlugin } from '../../../composables/tools/image-editor/editor/plugins/VideoPlugin';
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs';
import { useDesignStudio } from '../../../composables/tools/image-editor/useDesignStudio';
import StudioTimelineBar from './StudioTimelineBar.vue';

const { t } = useI18n();
const toast = useToast();
const { run, editor, bgStatus, bgProgress, zoomIn, zoomOut, zoomPercent, timelineOpen } = useFabricJs();
const canvas = useTemplateRef('canvas');
const route = useRoute();
const designStudio = useDesignStudio();

const isAiBusy = computed(() => bgStatus.value === 'loading' || bgStatus.value === 'processing');
const aiOverlayLabel = computed(() => {
  const progress = Math.round(bgProgress.value);
  if (bgStatus.value === 'processing') return t('canvas.aiWorking', { progress });
  return t('canvas.aiLoading', { progress });
});

const resetZoom = () => {
  const canvas = editor.value?.fabricCanvas;
  if (!canvas) return;
  canvas.setZoom(1);
  canvas.requestRenderAll();
};

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
    AlignGuidelinePlugin,
    MiddleMousePlugin,
    WatermarkPlugin,
    QrCodePlugin,
    SimpleClipImagePlugin,
    TransformPlugin,
    StudioPlugin,
    AnimationPlugin,
    ResizePlugin,
    VideoPlugin,
    // H5: enable two-finger zoom only on narrow/touch viewports
    ...(typeof window !== 'undefined' && window.innerWidth < 768 ? [TouchPlugin] : [])
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

  // Deep link: /tools/image-editor?designId=<id> reopens a saved studio design
  const designId = route.query.designId as string;
  if (designId && editor.value?.getPlugin('studio')) {
    const opened = await designStudio.openDesign(designId);
    if (opened) {
      toast.add({
        title: t('studio.templates.opened'),
        icon: 'i-lucide-check',
        color: 'success'
      });
    }
  }

  attachAutosave();

});

/** Autosave: canvas mutations mark the design dirty; saved designs debounce. */
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleAutosave = () => {
  if (designStudio.busy.value) return;
  designStudio.markDirty();
  if (!designStudio.currentId.value) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    void designStudio.saveDesign({ silent: true });
  }, designStudio.AUTOSAVE_DELAY_MS);
};

const attachAutosave = () => {
  const fabricCanvas = editor.value?.fabricCanvas;
  if (!fabricCanvas) return;
  fabricCanvas.on('object:modified', scheduleAutosave);
  fabricCanvas.on('object:added', scheduleAutosave);
  fabricCanvas.on('object:removed', scheduleAutosave);
};

onUnmounted(() => {
  if (autosaveTimer) clearTimeout(autosaveTimer);
});

const showImageLoadFailed = () => {
  toast.add({
    title: t('ai.errFailed'),
    icon: 'i-heroicons-exclamation-triangle',
    color: 'warning'
  });
};// Handle Drag and Drop on the workspace to add images
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
    class="canvas-dots flex-1 overflow-hidden bg-muted/60 relative flex items-center justify-center"
    @dragover.prevent @drop="onDrop">
    <div class="canvas-box shadow-2xl ring-1 ring-black/10">
      <canvas ref="canvas" class="editor" />
    </div>

    <!-- Bottom zoom pill (Polotno-style) -->
    <div
      class="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full border border-default bg-elevated/90 backdrop-blur-md px-1.5 py-1 shadow-lg"
      :class="timelineOpen ? 'bottom-[7.5rem]' : 'bottom-3'">
      <UButton variant="ghost" color="neutral" icon="lucide:minus" size="xs" :aria-label="t('menu.vertical.zoomOut')" @click="zoomOut" />
      <button
        type="button"
        class="px-2 min-w-14 text-center text-xs font-mono text-toned hover:text-highlighted transition-colors"
        data-testid="zoom-level"
        :aria-label="t('menu.vertical.resetZoom')"
        @click="resetZoom">
        {{ zoomPercent }}%
      </button>
      <UButton variant="ghost" color="neutral" icon="lucide:plus" size="xs" :aria-label="t('menu.vertical.zoomIn')" @click="zoomIn" />
    </div>

    <StudioTimelineBar />

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
  background-image: radial-gradient(color-mix(in srgb, currentColor 9%, transparent) 1px, transparent 1px);
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
