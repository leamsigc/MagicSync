<script lang="ts" setup>
import type { Collections } from '@nuxt/content'

/**
 *
 * Render the content from nuxt content folder
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { withLeadingSlash } from 'ufo'
const route = useRoute()
const collectionType = route.path.startsWith('/blogs/') ? 'blog' : 'content'
const { locale, localeProperties } = useI18n()

const slug = computed(() => withLeadingSlash(String(route.params.slug||'')))

// Blog documents are stored with the public `/blogs` prefix (see content.config.ts),
// so normalize any locale-prefixed route (/es/blogs/x -> /blogs/x) before querying.
const blogPath = computed(() => route.path.replace(/^\/(?:es|de|fr)?\/blogs/, '/blogs'))

const { data: page } = await useAsyncData(`page-${slug.value}`, async () => {

  const collection = (`${collectionType}_${locale.value}`) as keyof Collections
  const path = collectionType === 'blog' ? blogPath.value : slug.value.replace(',', '/')


  let content = await queryCollection(collection).path(`${path}`).first()

  // Fallback to default locale if content is missing
  if (!content && locale.value !== 'en') {
    const defaultCollection = (`${collectionType}_en`) as keyof Collections;
    content = await queryCollection(defaultCollection).path(`${collectionType === 'blog' ? blogPath.value : slug.value}`).first()
  }

  return content
}, {
  watch: [locale],
})
// if (!page.value) {
//   throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
// }
useHead(page.value?.meta || {})
useSeoMeta(page.value?.seo || {})

if (page.value) {
  // BlogOgImage expects imageUrl/title/description/headline, but markdown
  // frontmatter historically passes `image` and omits text props (which would
  // render the component's literal 'title'/'description' placeholders and the
  // default fallback image). Normalize here: explicit props win, page fields
  // fill the gaps. The legacy `image` key is dropped so it isn't encoded
  // into the OG URL as an unknown prop. Pages without `ogImage` frontmatter
  // still emit a tag from title/description so no page warns as missing.
  const ogProps = { ...((page.value.ogImage?.props || {}) as Record<string, string | undefined>) }
  const legacyImage = ogProps.image
  delete ogProps.image
  const pageImage = (page.value as { image?: { src?: string } }).image?.src
  defineOgImage("BlogOgImage", {
    title: page.value.title,
    description: page.value.description,
    headline: (page.value as { category?: string }).category,
    ...ogProps,
    imageUrl: ogProps.imageUrl || legacyImage || pageImage,
  })
}

if (collectionType === 'blog' && page.value) {
  // Blog posts are articles, not generic websites — correct og:type plus
  // publish time for link previews and crawlers.
  const publishedAt = (page.value as { publishedAt?: string; date?: string }).publishedAt
    || (page.value as { date?: string }).date
  useSeoMeta({
    ogType: 'article',
    ...(publishedAt ? { articlePublishedTime: publishedAt } : {}),
  })
}
</script>

<template>
  <article>
    <ContentRenderer v-if="page" :value="page" :dir="localeProperties?.dir ?? 'ltr'" />
    <BaseNotFoundView v-else />
  </article>
</template>
<style scoped></style>
