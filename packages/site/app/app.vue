<script lang="ts" setup>
/**
 * Global SEO setup for the site layer:
 * - Short `| MagicSync` title suffix (the Nuxt SEO default appends the full
 *   site name, pushing every title past 60 chars and truncating keywords).
 * - hreflang alternates + og:locale from @nuxtjs/i18n (4-locale site).
 * - Organization schema site-wide.
 */
const SITE_URL = 'https://magicsync.dev'

const i18nHead = useLocaleHead({ seo: true })

useHead(() => ({
  htmlAttrs: { lang: i18nHead.value.lang?.lang },
  link: i18nHead.value.link,
  meta: i18nHead.value.meta,
  titleTemplate: (title?: string | null) => {
    if (!title) return undefined
    // Strip any previously-appended brand segment before adding the short one.
    const base = title.replace(/\s*[|\u2013\u2014-]\s*MagicSync.*$/i, '').trim()
    return base ? `${base} | MagicSync` : 'MagicSync'
  }
}))

useSchemaOrg([
  defineOrganization({
    name: 'MagicSync',
    url: SITE_URL,
    logo: `${SITE_URL}/img/logo.png`,
  }),
])
</script>

<template>
  <BaseRootPage />
  <PodcastPlayer />
</template>
