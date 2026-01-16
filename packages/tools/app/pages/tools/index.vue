<!--  Translation file -->
<i18n src="./tools.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Tools
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const posts = ref([
  {
    title: 'Image Editor',
    description: 'Edit your images for free and use templates for social media',
    image: '/img/ImageEditor.png',
    date: '2024-11-25',
    to: "/tools/image-editor"
  },
  {
    title: 'Flutter clipper',
    description: 'Create Custom clippers for your flutter apps',
    image: '/img/flutter-clipper.png',
    date: '2024-11-04',
    to: "/tools/flutter-clipper"
  },
  {
    title: 'Video Silence Remover',
    description: 'Remove silent parts from your videos automatically with our free online tool',
    image: '/img/video-remover.png',
    date: '2024-12-11',
    to: "/tools/video-silence-remover"
  },
])
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
    imageUrl: "https://raw.githubusercontent.com/leamsigc/MagicSync/refs/heads/main/images/HomePage.png"
  }
})
</script>

<template>
  <section class="min-h-screen min-w-full relative">
    <main class="min-h-screen fixed inset-0">
      <section class="min-h-screen relative p-10 bg-background-foreground">
        <BaseHeader />
        <section class="mt-24">
          <UBlogPosts :posts="posts" />
        </section>
      </section>
    </main>
    <!-- <section class="min-h-screen relative p-10 bg-background-foreground py-24">
    </section> -->
  </section>
</template>
<style scoped></style>
