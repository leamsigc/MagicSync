<script lang="ts" setup>
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

import type { BlogEnCollectionItem, Collections } from '@nuxt/content';
const { locale } = useI18n()

const blogCollection = (`blog_${locale.value}`) as keyof Collections

// Get the articles that have the flag of featured to true from nuxt content
const { data: featuredArticles } = await useAsyncData("featured_posts", () =>

  queryCollection(blogCollection as "blog_en")
    .where('featured', '=', 1)
    .select('path', 'title', 'publishedAt', 'image', 'author', 'tags')
    .order('publishedAt', 'DESC')
    .all()
);

</script>

<template>
  <section class="grid gap-6 md:grid-cols-2 md:gap-12 mb-6 md:mb-12">
    <div v-for="article in featuredArticles" :key="article.path"
      class="group flex flex-col space-y-3 md:space-y-6  transition-transform">
      <NuxtLinkLocale
        class="object-contain aspect-video rounded-xl overflow-hidden flex items-center justify-center transition-all dark:group-hover:opacity-80 hover:hue-rotate-90"
        :to="article.path" :title="article.title">
        <NuxtPicture loading="lazy" class="w-full h-full" :src="article.image.src" :alt="article.image.alt" width="600"
          height="300" />
      </NuxtLinkLocale>
      <div class="space-y-3 md:space-y-5 pr-3 flex-1">
        <NuxtLinkLocale :to="article.path" :title="article.title">
          <h3 class="group-hover:text-primary transition-colors text-2xl font-semibold leading-tight">
            {{ article.title }}
          </h3>
        </NuxtLinkLocale>
        <div class="flex justify-between mt-auto">
          <div class="flex flex-col md:flex-row gap-3 md:gap-5">
            <div class="flex items-center space-x-2.5">
              <UAvatar :src="article.author.avatar" :alt="article.author.name" :text="article.author.name.slice(0, 1)"
                size="md" />
              <NuxtLink :href="article.author.social" class="flex flex-col" target="_blank"
                :title="article.author.name">

                <span class="text-sm font-semibold dark:text-white/80">
                  {{ article.author.name }}
                </span>
                <span class="text-xs dark:text-white/60">
                  {{ article.author.social }}
                </span>
              </NuxtLink>
            </div>
          </div>
          <p class="text-sm dark:text-white/60">
            <span class="text-xs dark:text-white/60">
              <time :datetime="article.publishedAt">
                {{ new Date(article.publishedAt).toLocaleDateString() }}
              </time>
            </span>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
<style scoped></style>
