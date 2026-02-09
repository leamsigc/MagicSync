<script lang="ts" setup>
/**
 *
 * Component Description: Twitter-style sidebar navigation for dashboard
 * Follows the design pattern from BaseSidebarNavigation with navigation links and user menu
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const appConfig = useAppConfig()
const companyName = appConfig.BaseUiLayer.footer.companyName
const { navigationLinks, userMenuItems, t } = useDashboardNavigation()
const { user } = UseUser()

interface Props {
  collapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false
})
</script>

<template>
  <div class="flex flex-col h-screen justify-between p-4 sticky top-0 overflow-y-auto">
    <div class="space-y-4">
      <!-- Logo -->
      <div class="px-4 py-2">
        <UTooltip :text="t('navigation.home')" :kbds="['meta', 'H']">
          <UButton color="neutral" variant="ghost" to="/app" icon="fxemoji:flaginhole"
            :aria-label="t('navigation.home')" size="xl" class="font-bold text-xl">
            <span v-if="!collapsed">{{ companyName }}</span>
          </UButton>
        </UTooltip>
      </div>

      <!-- Navigation Links -->
      <nav class="space-y-1">
        <template v-for="link in navigationLinks" :key="link.label">
          <NuxtLink :to="link.to"
            class="flex items-center gap-4 px-4 py-3 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors group"
            :class="{
              'font-bold': link.active,
              'w-max': collapsed,
              'w-full': !collapsed
            }">
            <UIcon :name="link.icon" class="w-7 h-7 text-gray-900 dark:text-white" />
            <span v-if="!collapsed" class="text-xl font-normal text-gray-900 dark:text-white truncate">
              {{ link.label }}
            </span>
          </NuxtLink>

          <!-- Deep Links (Children) -->
          <div v-if="link.children && !collapsed" class="flex flex-col space-y-1 pl-16">
            <NuxtLink v-for="child in link.children" :key="child.label" :to="child.to"
              class="flex items-center gap-4 px-4 py-2 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors">
              <UIcon :name="child.icon" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <span class="text-base font-normal text-gray-500 dark:text-gray-400 truncate">
                {{ child.label }}
              </span>
            </NuxtLink>
          </div>
        </template>
      </nav>

      <!-- Post Button -->
      <div class="mt-4">
        <UButton variant="solid" color="primary" class="rounded-full w-full grid place-items-center text-xl"
          to="/app/posts/new" :label="collapsed ? '' : 'Post'" :icon="collapsed ? 'i-lucide-plus' : undefined" />
      </div>
    </div>

    <!-- Footer Actions & Profile -->
    <div class="space-y-4">
      <!-- Tools/Toggles -->
      <div v-if="!collapsed" class="flex flex-wrap items-center gap-2 px-2">
        <BaseTranslationMenu />
        <UColorModeButton />
        <UTooltip :text="t('navigation.openOnGitHub')" :kbds="['meta', 'G']">
          <UButton color="neutral" variant="ghost" to="https://github.com/leamsigc/magicsync" target="_blank"
            icon="i-simple-icons-github" :aria-label="t('navigation.openOnGitHub')" />
        </UTooltip>
      </div>

      <!-- User Profile Dropdown -->
      <UDropdownMenu :items="userMenuItems" :ui="{ content: 'bg-gray-50 dark:bg-gray-950' }">
        <UButton color="neutral" variant="ghost" class="w-full justify-start p-0">
          <div
            class="flex items-center gap-3 p-3 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 cursor-pointer transition-colors w-full">
            <UAvatar :src="user?.image || ''" :alt="user?.name" size="sm" />
            <div v-if="!collapsed" class="flex-1 min-w-0">
              <div class="font-bold text-sm text-gray-900 dark:text-white truncate">
                {{ user?.name || 'User' }}
              </div>
              <div class="text-sm text-gray-500 dark:text-gray-400 truncate">
                {{ user?.email || 'email@domain.com' }}
              </div>
            </div>
            <UIcon v-if="!collapsed" name="i-heroicons-ellipsis-horizontal" class="w-5 h-5 text-gray-500" />
          </div>
        </UButton>

        <template #account="{ item }">
          <div class="flex items-center gap-3 p-3">
            <UAvatar :src="item.avatar?.src" :alt="item.avatar?.alt" size="2xl" />
            <div class="text-left min-w-0 flex-1">
              <p class="truncate font-medium text-sm">
                {{ item.label }}
              </p>
              <p class="truncate text-xs text-gray-500 dark:text-gray-400">
                {{ item.email }}
              </p>
            </div>
          </div>
        </template>

        <template #item="{ item }">
          <div class="flex items-center gap-2">
            <UIcon v-if="'icon' in item" :name="item.icon" class="shrink-0 h-4 w-4 text-gray-500" />
            <span class="truncate">{{ item.label }}</span>
            <UBadge v-if="'badge' in item" :label="item.badge" variant="subtle" size="xs" class="ml-auto" />
          </div>
        </template>

        <template #item-leading="{ item }">
          <UIcon v-if="'icon' in item" :name="item.icon" class="shrink-0 h-4 w-4 text-gray-500" />
        </template>
      </UDropdownMenu>
    </div>
  </div>
</template>

<style scoped>
/* Scoped styles if needed */
</style>
