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
import { TransformPlugin } from '../composables/editor/plugins/TransformPlugin';
import { ToolsPlugin } from '../composables/editor/ToolsPlugin';
import { useFabricJs } from '../composables/useFabricJs';

const { run, editor } = useFabricJs();
const { start } = useImageTransformer();
const canvas = useTemplateRef('canvas');
const route = useRoute();

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

  if (editor.value) {
    // Start the image transformer if needed
    start();
  }

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
    } catch (error) {
      console.error('Failed to load image from query param:', error);
    }
  }

});

// Handle Drag and Drop on the workspace to add images
const onDrop = (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    const file = e.dataTransfer.files[0];
    if (file.type.startsWith('image/')) {
      editor.value?.addImageLayer(file);
    }
  }
}
</script>

<template>
  <div id="workspace"
    class="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-950/50 relative flex items-center justify-center"
    @dragover.prevent @drop="onDrop">
    <div class="canvas-box shadow-2xl">
      <canvas ref="canvas" class="editor" />
    </div>
  </div>
</template>

<style scoped>
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
