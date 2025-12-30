<script lang="ts" setup>
import { CorePlugin } from '../composables/editor/CorePlugin';
import { HooksPlugin } from '../composables/editor/HooksPlugin';
import { HistoryPlugin } from '../composables/editor/plugins/HistoryPlugin';
import { AlignPlugin } from '../composables/editor/plugins/AlignPlugin';
import { WorkspacePlugin } from '../composables/editor/plugins/WorkspacePlugin';
import { LayerPlugin } from '../composables/editor/plugins/LayerPlugin';
import { AddBaseTypePlugin } from '../composables/editor/plugins/AddBaseTypePlugin';
import { FontPlugin } from '../composables/editor/plugins/FontPlugin';
import { FilterPlugin } from '../composables/editor/plugins/FilterPlugin';
import { ShadowPlugin } from '../composables/editor/plugins/ShadowPlugin';
import { DrawPlugin } from '../composables/editor/plugins/DrawPlugin';
import { ExportPlugin } from '../composables/editor/plugins/ExportPlugin';
import { ClipboardPlugin } from '../composables/editor/plugins/ClipboardPlugin';
import { HotkeyPlugin } from '../composables/editor/plugins/HotkeyPlugin';
import { GroupPlugin } from '../composables/editor/plugins/GroupPlugin';
import { LockPlugin } from '../composables/editor/plugins/LockPlugin';
import { RulerPlugin } from '../composables/editor/plugins/RulerPlugin';
import { useFabricJs } from '../composables/useFabricJs';
const { run, addImageLayer, addImageLayerFromUrl, getCanvasPlugin, editor } = useFabricJs();
const { start } = useImageTransformer();
const canvas = useTemplateRef('canvas');

const files = ref<File>();

const route = useRoute();



onMounted(async () => {
  run(canvas);
  if (editor.value) {
    // Start the image transformer if needed
    start();
  }
  const imageId = route.query.imageId as string;


  if (imageId) {
    try {
      const url = `/api/v1/assets/serve/${imageId}.png`;
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const file = new File([blob], `${imageId}.png`, { type: 'image/png' });
        files.value = file;
        addImageLayerFromUrl(url);
      }
    } catch (error) {
      console.error('Failed to load image from query param:', error);
    }
  }


  // Register all modular plugins
  editor.value
    .use(CorePlugin)
    .use(HooksPlugin)
    .use(HistoryPlugin)
    .use(AlignPlugin)
    .use(WorkspacePlugin)
    .use(LayerPlugin)
    .use(AddBaseTypePlugin)
    .use(FontPlugin)
    .use(FilterPlugin)
    .use(ShadowPlugin)
    .use(DrawPlugin)
    .use(ExportPlugin)
    .use(ClipboardPlugin)
    .use(HotkeyPlugin)
    .use(GroupPlugin)
    .use(LockPlugin)
    .use(RulerPlugin);
});

const onFileDrop = async (f: File | File[] | null | undefined) => {
  if (files.value) return;
  const isArray = Array.isArray(f);
  if (!canvas.value || !f || isArray) return;
  const file = f;
  if (!file) return; // Ensure file is not undefined

  files.value = file; // Update the files ref
  addImageLayer(file);
};
</script>

<template>
  <div id="workspace">
    <div class="canvas-box grid place-content-center">
      <div class="inside-shadow"></div>
      <canvas ref="canvas" class="m-auto editor" :class="{ 'opacity-0': !files }" />
    </div>
  </div>
  <section v-show="!files" class="w-screen h-screen absolute inset-0 bg-background/10 grid place-content-center">
    <!-- Step 1 Select Image -->
    <UFileUpload @update:model-value="onFileDrop" color="error" variant="area" label="Drop your image here"
      description="SVG, PNG, JPG or GIF (max. 2MB)" class="w-96 min-h-48 " />
  </section>
</template>
<style scoped>
.canvas-container {
  margin: auto 0;
}

.canvas-box {
  position: relative;
}

.inside-shadow {
  position: absolute;
  width: 100%;
  height: 100%;
  box-shadow: inset 0 0 9px 2px #0000001f;
  z-index: 2;
  pointer-events: none;
}

#canvas {
  width: 300px;
  height: 300px;
  margin: 0 auto;
}

#workspace {
  flex: 1;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.editor {
  --offsetX: 0px;
  --offsetY: 0px;
  --size: 16px;
  --color: #dedcdc;
  background-image: linear-gradient(45deg,
      var(--color) 25%,
      transparent 0,
      transparent 75%,
      var(--color) 0),
    linear-gradient(45deg, var(--color) 25%, transparent 0, transparent 75%, var(--color) 0);
  background-position: var(--offsetX) var(--offsetY),
    calc(var(--size) + var(--offsetX)) calc(var(--size) + var(--offsetY));
  background-size: calc(var(--size) * 2) calc(var(--size) * 2);
}
</style>
