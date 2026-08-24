<script lang="ts" setup>
/**
 * Global SEO setup for the content layer (mirrors the site layer):
 * short title suffix, hreflang alternates, Organization schema.
 */
const SITE_URL = 'https://magicsync.dev'

const i18nHead = useLocaleHead({ seo: true })

useHead(() => ({
  htmlAttrs: { lang: i18nHead.value.lang?.lang },
  link: i18nHead.value.link,
  meta: i18nHead.value.meta,
  titleTemplate: (title?: string | null) => {
    if (!title) return undefined
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
</template>
