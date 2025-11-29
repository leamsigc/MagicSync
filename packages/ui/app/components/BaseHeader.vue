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
const appConfig = useAppConfig()

const companyName = appConfig.BaseUiLayer.footer.companyName
const route = useRoute()

const items = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Dev docs',
    to: '/ui-preview',
    active: route.path.startsWith('/ui-preview')
  },
  {
    label: 'Blogs',
    to: '/blog',
    active: route.path.startsWith('/blog')
  },
  {
    label: 'Platform ',
    to: '/platform',
    active: route.path.startsWith('/platform'),
    class: "px-10",
    children: [
      {
        label: 'Google My Business',
        description: 'Grow your Google My Business audience with use of AI',
        to: '/platform/google-my-business',
        icon: 'i-lucide-house',
      },
      {
        label: 'Facebook',
        description: 'Grow your Facebook audiance with use of AI',
        to: '/platform/facebook',
        icon: 'i-lucide-facebook'
      },
      {
        label: 'Twitter',
        description: 'Grow your Twitter audience with use of AI',
        to: '/platform/twitter',
        icon: 'i-lucide-twitter'
      },
      {
        label: 'Instagram',
        description: 'Grow your Instagram audience with use of AI',
        to: '/platform/instagram',
        icon: 'i-lucide-instagram'
      },
      {
        label: 'Linkedin',
        description: 'Grow your Linkedin audience with use of AI',
        to: '/platform/linkedin',
        icon: 'i-lucide-linkedin'
      },
      {
        label: 'Pinterest',
        description: 'Grow your Pinterest audience with use of AI',
        to: '/platform/pinterest',
        icon: 'i-lucide-pinterest'
      }
    ]
  },
  {
    label: 'Tools',
    to: '/tools',
    active: route.path.startsWith('/tools')
  },
  {
    label: 'Playground',
    to: '/playground',
    active: route.path.startsWith('/playground')
  }
])
</script>

<template>
  <UHeader class="dark:bg-transparent  border-0">
    <template #left>
      <UTooltip text="Home" :kbds="['meta', 'H']">
        <UButton color="neutral" variant="ghost" to="/" icon="fxemoji:flaginhole" aria-label="Home">
          {{ companyName }}
        </UButton>
      </UTooltip>
    </template>
    <UNavigationMenu :items="items" :ui="{
      childLinkDescription: 'text-balance line-clamp-2 ',
      linkLabel: 'dark:text-white',
    }" orientation="horizontal" class="w-full justify-center " highlight highlight-color="success" />
    <template #right>
      <UColorModeButton />


      <UTooltip text="Login" :kbds="['meta', 'L']">
        <UButton color="primary" variant="ghost" to="/login" icon="i-lucide-user" aria-label="Login" />
      </UTooltip>
      <BaseTranslationMenu />
      <UTooltip text="Open on GitHub" :kbds="['meta', 'G']">
        <UButton color="neutral" variant="ghost" to="https://github.com/leamsigc/magicsync"
          target="_blank" icon="i-simple-icons-github" aria-label="GitHub" />
      </UTooltip>
    </template>
  </UHeader>
</template>
<style scoped></style>
