<!--  Translation file -->
<i18n src="./ImageEditor.json"></i18n>
<script lang="ts" setup>
import ImageCanvasEditor from './components/ImageCanvasEditor.vue';
import ImageEditorHeader from './components/ImageEditorHeader.vue';
import ImageEditorSidebar from './components/ImageEditorSidebar.vue';
import ImageEditorProperties from './components/ImageEditorProperties.vue';

/**
 *
 * Image editor using fabric js — Figma-style layout:
 * top bar / left tool rail + panel / canvas / right properties.
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 */

const { t } = useI18n()
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

    <div class="flex-1 flex overflow-hidden">
      <ImageEditorSidebar class="shrink-0" />

      <ImageCanvasEditor class="flex-1 relative z-0" />

      <ImageEditorProperties class="shrink-0" />
    </div>
  </main>
</template>
