<!--  Translation file -->
<i18n src="./tools.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Tools
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.2
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { toolRegistry } from '#layers/BaseUI/app/utils/toolRegistry'

const posts = computed(() => toolRegistry.map(tool => ({
  title: tool.name,
  description: tool.description,
  image: tool.image ?? '/img/ImageEditor.png',
  date: tool.date ?? '2026-08-23',
  to: tool.route
})))
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
  imageUrl: "https://raw.githubusercontent.com/leamsigc/MagicSync/refs/heads/main/images/HomePage.png"
})
</script>

<template>
  <section class="min-h-screen min-w-full ">
    <main class="min-h-screen inset-0">
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
