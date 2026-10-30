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

// Locale-free path for content lookups. The collections store paths without the
// locale prefix (`content_en`: `/platform/tiktok`), and `/es/...` must resolve
// to the same document before the English fallback is attempted.
const contentPath = computed(() => route.path.replace(/^\/(es|de|fr)(?=\/|$)/, '') || '/')

// Blog documents are stored with the public `/blogs` prefix (see content.config.ts),
// so normalize any locale-prefixed route (/es/blogs/x -> /blogs/x) before querying.
const blogPath = computed(() => route.path.replace(/^\/(?:es|de|fr)?\/blogs/, '/blogs'))

const { data: page } = await useAsyncData(`page-${slug.value}`, async () => {

  const collection = (`${collectionType}_${locale.value}`) as keyof Collections
  const path = collectionType === 'blog' ? blogPath.value : contentPath.value


  let content = await queryCollection(collection).path(`${path}`).first()

  // Fallback to default locale if content is missing
  if (!content && locale.value !== 'en') {
    const defaultCollection = (`${collectionType}_en`) as keyof Collections;
    content = await queryCollection(defaultCollection).path(`${collectionType === 'blog' ? blogPath.value : contentPath.value}`).first()
  }

  return content
}, {
  watch: [locale],
})
// if (!page.value) {
//   throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
// }
// Agent landings live under /for; a missing agent slug must be a real 404,
// not the generic soft-404 shell (search engines would index it as a page).
if (!page.value && slug.value.startsWith('/for')) {
  throw createError({ statusCode: 404, statusMessage: 'Agent page not found', fatal: true })
}

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

if (slug.value === '/' && page.value) {
  // The homepage describes the product itself (pricing/features are visible
  // in the FAQ and feature sections above), so emit SoftwareApplication —
  // the Organization/WebSite graph from @nuxtjs/seo doesn't cover it.
  // Prices mirror the FAQ content: free self-hosted, Pro $29/month.
  // Module-idiomatic: joins the identity graph, relative URLs resolve
  // against the site URL automatically.
  useSchemaOrg([
    defineSoftwareApp({
      name: 'MagicSync',
      url: '/',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: page.value.description,
      offers: [
        {
          '@type': 'Offer',
          name: 'Self-hosted',
          price: '0',
          priceCurrency: 'USD',
        },
        {
          '@type': 'Offer',
          name: 'Pro',
          price: '29',
          priceCurrency: 'USD',
        },
      ],
    }),
  ])
}
</script>

<template>
  <article class="content-body">
    <ContentRenderer v-if="page" :value="page" :dir="localeProperties?.dir ?? 'ltr'" />
    <BaseNotFoundView v-else />
  </article>
</template>
<style scoped>
/* Long inline code and code blocks are the main way a Content page gets wider
   than a phone. Wrap the words; let a block scroll on its own. */
.content-body :deep(code) {
  overflow-wrap: anywhere;
}
.content-body :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
}
</style>
