<script lang="ts" setup>
/**
 * Component Description: Sidebar Navigation for the Twitter-like interface
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const { t } = useI18n()
const appConfig = useAppConfig()
const companyName = appConfig.BaseUiLayer.footer.companyName
const { links } = useNavigationLinks()

const user = {
  name: 'Ismael Garcia',
  handle: '@leamsigc',
  avatar: 'https://avatars.githubusercontent.com/u/23272293?s=96&v=4'
};
</script>

<template>
  <div class="flex flex-col h-screen justify-between p-4 sticky top-0 overflow-y-auto">
    <div class="space-y-4">
      <!-- Logo -->
      <div class="px-4 py-2">
        <UTooltip :text="t('navigation.home')" :kbds="['meta', 'H']">
          <UButton color="neutral" variant="ghost" to="/" icon="fxemoji:flaginhole" :aria-label="t('navigation.home')"
            size="xl" class="font-bold text-xl">
            {{ companyName }}
          </UButton>
        </UTooltip>
      </div>

      <!-- Navigation Links -->
      <nav class="space-y-1">
        <template v-for="link in links" :key="link.label">
          <NuxtLinkLocale :to="link.to"
            class="flex items-center gap-4 px-4 py-3 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors w-max xl:w-full group"
            :class="{ 'font-bold': link.active }">
            <UIcon :name="link.icon" class="w-7 h-7 text-gray-900 dark:text-white" />
            <span
              class="hidden xl:inline text-xl font-normal text-gray-900 dark:text-white line-clamp-[calc(var(--characters)/100)] truncate">
              {{ link.label }}
            </span>
          </NuxtLinkLocale>

          <!-- Deep Links (Children) -->
          <div v-if="link.children" class="flex flex-col space-y-1 ml-12 xl:ml-0">
            <NuxtLinkLocale v-for="child in link.children" :key="child.label" :to="child.to"
              class="flex items-center gap-4 px-4 py-2 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors w-max xl:w-full xl:pl-16">
              <UIcon :name="child.icon" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <span
                class="hidden xl:inline text-base font-normal text-gray-500 dark:text-gray-400 line-clamp-[calc(var(--characters)/100)] truncate">
                {{ child.label }}
              </span>
            </NuxtLinkLocale>
          </div>
        </template>
      </nav>

      <!-- Tweet Button -->
      <div class="mt-4">
        <UButton variant="solid" color="primary" class=" rounded-full w-full grid place-items-center text-xl"
          label="Post" />
      </div>
    </div>

    <!-- Footer Actions & Profile -->
    <div class="space-y-4">
      <!-- Tools/Toggles -->
      <div class="flex flex-wrap items-center gap-2 px-2">
        <BaseTranslationMenu />
        <UColorModeButton />
        <UTooltip :text="t('navigation.login')" :kbds="['meta', 'L']">
          <UButton color="primary" variant="ghost" to="/login" icon="i-lucide-user"
            :aria-label="t('navigation.login')" />
        </UTooltip>
        <UTooltip :text="t('navigation.openOnGitHub')" :kbds="['meta', 'G']">
          <UButton color="neutral" variant="ghost" to="https://github.com/leamsigc/magicsync" target="_blank"
            icon="i-simple-icons-github" :aria-label="t('navigation.openOnGitHub')" />
        </UTooltip>
      </div>

      <!-- User Profile -->
      <div
        class="flex items-center gap-3 p-3 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 cursor-pointer transition-colors w-full">
        <UAvatar :src="user.avatar" :alt="user.name" size="sm" />
        <div class="hidden xl:block flex-1">
          <div class="font-bold text-sm text-gray-900 dark:text-white">{{ user.name }}</div>
          <div class="text-sm text-gray-500 dark:text-gray-400">{{ user.handle }}</div>
        </div>
        <UIcon name="i-heroicons-ellipsis-horizontal" class="w-5 h-5 text-gray-500 hidden xl:block" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scoped styles if needed */
</style>
