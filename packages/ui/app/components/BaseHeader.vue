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
import type { NavigationMenuItem } from '@nuxt/ui'
const { t, locale } = useI18n()
const appConfig = useAppConfig()

const companyName = appConfig.BaseUiLayer.footer.companyName
const route = useRoute()
const selectedLanguage = computed(() => {
  return locale.value === 'en' ? '' : `/${locale.value}`
})
const items = computed<NavigationMenuItem[]>(() => [
  {
    label: t('navigation.devDocs'),
    to: `${selectedLanguage.value}/ui-preview`,
    active: route.path.startsWith(`${selectedLanguage.value}/ui-preview`),
  },
  {
    label: t('navigation.blogs'),
    to: `${selectedLanguage.value}/blog`,
    active: route.path.startsWith(`${selectedLanguage.value}/blog`)
  },
  {
    label: t('navigation.platform'),
    to: `${selectedLanguage.value}/platform`,
    active: route.path.startsWith(`${selectedLanguage.value}/platform`),
    class: "px-10",
    children: [
      {
        label: t('navigation.googleMyBusiness'),
        description: t('navigation.googleMyBusinessDesc'),
        to: `${selectedLanguage.value}/platform/google-my-business`,
        icon: 'i-lucide-house',

      },
      {
        label: t('navigation.facebook'),
        description: t('navigation.facebookDesc'),
        to: `${selectedLanguage.value}/platform/facebook`,
        icon: 'i-lucide-facebook'
      },
      {
        label: t('navigation.twitter'),
        description: t('navigation.twitterDesc'),
        to: `${selectedLanguage.value}/platform/twitter`,
        icon: 'i-lucide-twitter'
      },
      {
        label: t('navigation.instagram'),
        description: t('navigation.instagramDesc'),
        to: `${selectedLanguage.value}/platform/instagram`,
        icon: 'i-lucide-instagram'
      },
      {
        label: t('navigation.linkedin'),
        description: t('navigation.linkedinDesc'),
        to: `${selectedLanguage.value}/platform/linkedin`,
        icon: 'i-lucide-linkedin'
      },
      {
        label: t('navigation.pinterest'),
        description: t('navigation.pinterestDesc'),
        to: `${selectedLanguage.value}/platform/pinterest`,
        icon: 'i-lucide-pinterest'
      }
    ]
  },
  {
    label: t('navigation.tools'),
    to: `${selectedLanguage.value}/tools`,
    active: route.path.startsWith(`${selectedLanguage.value}/tools`)
  },
  {
    label: t('navigation.playground'),
    to: `${selectedLanguage.value}/playground`,
    active: route.path.startsWith(`${selectedLanguage.value}/playground`)
  }
])
</script>

<template>
  <UHeader class="dark:bg-transparent  border-0" mode="drawer">
    <template #left>
      <UTooltip :text="t('navigation.home')" :kbds="['meta', 'H']">
        <UButton color="neutral" variant="ghost" :to="selectedLanguage || '/'" icon="fxemoji:flaginhole"
          :aria-label="t('navigation.home')">
          {{ companyName }}
        </UButton>
      </UTooltip>
    </template>

    <UNavigationMenu :items="items" :ui="{
      childLinkDescription: 'text-balance line-clamp-2 ',
      linkLabel: 'dark:text-white',
    }" orientation="horizontal" class="w-full justify-center " highlight highlight-color="success" />
    <template #right>
      <BaseTranslationMenu />
      <UColorModeButton />
      <UTooltip :text="t('navigation.login')" :kbds="['meta', 'L']">
        <UButton color="primary" variant="ghost" :to="`${selectedLanguage}/login`" icon="i-lucide-user"
          :aria-label="t('navigation.login')" />
      </UTooltip>
      <UTooltip :text="t('navigation.openOnGitHub')" :kbds="['meta', 'G']">
        <UButton color="neutral" variant="ghost" to="https://github.com/leamsigc/magicsync" target="_blank"
          icon="i-simple-icons-github" :aria-label="t('navigation.openOnGitHub')" />
      </UTooltip>
    </template>

    <template #body>
      <section class="grid">
        <UTooltip :text="t('navigation.home')" :kbds="['meta', 'H']">
          <UButton color="neutral" variant="ghost" :to="selectedLanguage || '/'" icon="fxemoji:flaginhole"
            :aria-label="t('navigation.home')">
            {{ companyName }}
          </UButton>
        </UTooltip>
        <UTooltip :text="t('navigation.login')" :kbds="['meta', 'L']">
          <UButton color="primary" variant="ghost" :to="`${selectedLanguage}/login`" icon="i-lucide-user"
            :aria-label="t('navigation.login')" />
        </UTooltip>
        <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      </section>
    </template>
  </UHeader>
</template>
<style scoped></style>
