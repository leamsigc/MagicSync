<!--  Translation file -->
<i18n src="./ImageEditor.json"></i18n>
<script lang="ts" setup>
import ImageCanvasEditor from './components/ImageCanvasEditor.vue';
import ImageEditorHeader from './components/ImageEditorHeader.vue';
import ImageEditorSidebar from './components/ImageEditorSidebar.vue';
import ImageEditorProperties from './components/ImageEditorProperties.vue';

/**
 *
 * Image editor using fabric js
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

defineOgImage({
  component: "BlogOgImage",
  props: {
    title: t('title'),
    description: t('description'),
    headline: "Free Tools",
    imageUrl: "/img/home-dark.png"
  }
})
</script>

<template>
  <main class="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground">
      <!-- Top Bar -->
      <ImageEditorHeader class="shrink-0" />

      <!-- Main Content Area -->
      <div class="flex-1 flex overflow-hidden">
          <!-- Left Sidebar (Tools, Layers, Templates) -->
          <ImageEditorSidebar class="shrink-0" />

          <!-- Middle Canvas Area -->
          <ImageCanvasEditor class="flex-1 relative z-0" />

          <!-- Right Sidebar (Properties) -->
          <ImageEditorProperties class="shrink-0" />
      </div>
  </main>
</template>
<style scoped></style>
