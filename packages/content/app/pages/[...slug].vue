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

const slug = computed(() => withLeadingSlash(String(route.params.slug)))


const { data: page } = await useAsyncData(`page-${slug.value}`, async () => {

  console.log(slug.value)
  const collection = (`${collectionType}_${locale.value}`) as keyof Collections
  const path = collectionType === 'blog' ? `${route.path.replace('/blogs', '')}` : slug.value.replace(',', '/')


  let content = await queryCollection(collection).path(`${path}`).first()

  // Fallback to default locale if content is missing
  if (!content && locale.value !== 'en') {
    const defaultCollection = (`${collectionType}_en`) as keyof Collections;
    content = await queryCollection(defaultCollection).path(`${slug.value}`).first()
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
defineOgImage(page.value?.ogImage)
</script>

<template>
  <article>
    <ContentRenderer v-if="page" :value="page" :dir="localeProperties?.dir ?? 'ltr'" />
    <BaseNotFoundView v-else />
  </article>
</template>
<style scoped></style>
