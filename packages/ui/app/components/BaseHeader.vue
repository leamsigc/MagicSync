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
const { t } = useI18n()
const appConfig = useAppConfig()
const companyName = appConfig.BaseUiLayer.footer.companyName

const { links: items } = useNavigationLinks()
</script>

<template>
  <UHeader class="dark:bg-transparent  border-0" mode="drawer">
    <template #left>
      <UTooltip :text="t('navigation.home')" :kbds="['meta', 'H']">
        <UButton color="neutral" variant="ghost" to="/" icon="fxemoji:flaginhole" :aria-label="t('navigation.home')">
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
        <UButton color="primary" variant="ghost" to="/login" icon="i-lucide-user" :aria-label="t('navigation.login')" />
      </UTooltip>
      <UTooltip :text="t('navigation.openOnGitHub')" :kbds="['meta', 'G']">
        <UButton color="neutral" variant="ghost" to="https://github.com/leamsigc/magicsync" target="_blank"
          icon="i-simple-icons-github" :aria-label="t('navigation.openOnGitHub')" />
      </UTooltip>
    </template>

    <template #body>
      <section class="grid">
        <UTooltip :text="t('navigation.home')" :kbds="['meta', 'H']">
          <UButton color="neutral" variant="ghost" to="/" icon="fxemoji:flaginhole" :aria-label="t('navigation.home')">
            {{ companyName }}
          </UButton>
        </UTooltip>
        <UTooltip :text="t('navigation.login')" :kbds="['meta', 'L']">
          <UButton color="primary" variant="ghost" to="/login" icon="i-lucide-user"
            :aria-label="t('navigation.login')" />
        </UTooltip>
        <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      </section>
    </template>
  </UHeader>
</template>
<style scoped></style>
