<!--  Translation file -->
<i18n src="./ImageEditor.json"></i18n>
<script lang="ts" setup>
import ImageCanvasEditor from './components/ImageCanvasEditor.vue';
import ImageCanvasEditorRightMenu from './components/ImageCanvasEditorRightMenu.vue';
import ImageCanvasEditorVerticalMenu from './components/ImageCanvasEditorVerticalMenu.vue';
import ImageCanvasEditorMainMenu from './components/ImageCanvasEditorMainMenu.vue';

/**
 *
 * Image editor using fabric js
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
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

  <section class="min-h-screen min-w-full relative" />
  <main class="min-h-screen fixed inset-0">
    <section class="min-h-screen relative p-10 bg-background-foreground">
      <!-- Main menu -->
      <ImageCanvasEditorMainMenu />
      <!-- Vertical menu -->
      <ImageCanvasEditorVerticalMenu />
      <!-- Right menu -->
      <ImageCanvasEditorRightMenu />
      <!-- Fabricjs mount here -->
      <ImageCanvasEditor />
    </section>
  </main>
</template>
<style scoped></style>
