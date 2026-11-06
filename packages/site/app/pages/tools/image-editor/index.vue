<!--  Translation file -->
<i18n src="./ImageEditor.json"></i18n>
<script lang="ts" setup>
import ImageCanvasEditor from '#layers/BaseTools/app/components/tools/image-editor/ImageCanvasEditor.vue';
import ImageEditorHeader from '#layers/BaseTools/app/components/tools/image-editor/ImageEditorHeader.vue';
import ImageEditorSidebar from '#layers/BaseTools/app/components/tools/image-editor/ImageEditorSidebar.vue';
import ImageEditorProperties from '#layers/BaseTools/app/components/tools/image-editor/ImageEditorProperties.vue';
import StudioBulkModal from '#layers/BaseTools/app/components/tools/image-editor/StudioBulkModal.vue';
import { useFabricJs } from '#layers/BaseTools/app/composables/tools/image-editor/useFabricJs';

/**
 *
 * Image editor using fabric js — Figma-style layout:
 * top bar / left tool rail + panel / canvas / right properties.
 * On narrow (H5) viewports the properties panel collapses under the
 * sidebar panel and the canvas drops to the full remaining width.
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 */

const { t } = useI18n()
const { bulkModalOpen } = useFabricJs()
useHead({
  title: t('title'),
  meta: [
    { name: 'description', content: t('description') }
  ]
})

defineOgImage("BlogOgImage", {
  title: t('title'),
  description: t('description'),
  headline: "Free Tools",
  imageUrl: "/img/home-dark.png"
})
</script>

<template>
  <main class="h-screen w-screen overflow-hidden flex flex-col bg-default text-highlighted">
    <ImageEditorHeader class="shrink-0" />

    <div class="flex-1 min-h-0 flex overflow-hidden">
      <ImageEditorSidebar class="shrink-0" />
      <ImageCanvasEditor class="flex-1 min-w-0" />

      <!-- Properties: side column on desktop; hidden on H5 (rail + panel carry editing) -->
      <ImageEditorProperties class="shrink-0 hidden lg:flex w-[300px] min-h-0" />
    </div>

    <StudioBulkModal v-model:open="bulkModalOpen" />
  </main>
</template>
