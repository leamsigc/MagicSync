<script lang="ts" setup>
const { t } = useI18n()
const appConfig = useAppConfig()
const companyName = appConfig.BaseUiLayer.footer.companyName

const { links: items } = useNavigationLinks()
</script>

<template>
  <UHeader
    mode="drawer"
    :ui="{
      root: 'sticky top-4 z-50 mx-auto max-w-7xl bg-elevated rounded-2xl ',
      inner: 'w-full max-w-(--ui-container) mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 h-16'
    }"
  >
    <template #left>
      <UTooltip :text="t('navigation.home')" :kbds="['meta', 'H']">
        <UButton color="neutral" variant="ghost" to="/" icon="fxemoji:flaginhole" :aria-label="t('navigation.home')">
          {{ companyName }}
        </UButton>
      </UTooltip>
    </template>

    <UNavigationMenu
      :items="items"
      orientation="horizontal"
      class="w-full justify-center"
      highlight
      highlight-color="primary"
    />
    <template #right>
      <BaseThemeSelector />
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
      <section class="grid p-2 bg-elevated rounded-xl ">
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
