<script lang="ts" setup>
import type { Collections } from '@nuxt/content';

/**
 *
 * Component Description:Desc
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
const router = useRouter();
const { locale } = useI18n()
const blogCollection = (`blog_${locale.value}`) as keyof Collections
// Stored paths include the public `/blogs` segment; normalize locale prefixes only.
const path = router.currentRoute.value.path.replace(/^\/(?:es|de|fr)?\/blogs/, '/blogs');
const { data } = await useAsyncData(`${path}-blog-hero`, () =>
  queryCollection(blogCollection as "blog_en").path(path)
    .select('title', 'description', 'image', 'publishedAt', 'author')
    .first())

</script>

<template>
  <section class="space-y-12 md:space-y-20" v-if="data" v-motion-fade-visible-once>
    <div class="mx-auto max-w-3xl px-8">
      <div class="pt-12 ">
        <div class="flex flex-col justify-center items-center space-y-3 md:space-y-6 relative">
          <p class="text-aquamarine text-sm">
            <time :datetime="data.publishedAt">{{ new Date(data.publishedAt).toLocaleDateString() }}</time>
          </p>
          <h1 class="font-bold text-2xl md:text-5xl text-center">
            {{ data.title }}
          </h1>
          <div class="flex flex-col md:flex-row gap-3 md:gap-5">
            <div class="flex items-center space-x-2.5">
              <UAvatar :src="data.author.avatar" :alt="data.author.name" :text="data.author.name.slice(0, 1)"
                size="md" />
              <section class="grid">
                <span class="dark:text-white/70">{{ data.author.name }}</span>
                <span class="dark:text-white/30 text-sm">{{ data.author.role }}</span>
                <NuxtLink :title="data.author.social" :href="data.author.social" target="_blank"
                  class="dark:text-white/30 text-sm">
                  {{ data.author.social }}
                </NuxtLink>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="mx-auto max-w-7xl my-10 pb-10">
      <div class="object-contain bg-[#26303B] aspect-video rounded-xl overflow-hidden flex items-center justify-center">
        <NuxtPicture :alt="data.title" loading="eager" width="1080" height="900" class="w-full h-full"
          style="color: transparent;" :src="data.image.src" />
      </div>
    </div>
  </section>
</template>
<style scoped></style>
