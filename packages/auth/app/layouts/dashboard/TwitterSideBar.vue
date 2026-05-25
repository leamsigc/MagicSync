<script lang="ts" setup>
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
  <UScrollArea class="h-full w-full">
    <div class="rounded-2xl m-2 flex flex-col p-3 border border-white/10">
      <div class="space-y-3 flex-1">
        <div class="px-3 py-2">
          <UTooltip :text="t('navigation.home')" :kbds="['meta', 'H']">
            <UButton color="neutral" variant="ghost" to="/app" icon="fxemoji:flaginhole"
              :aria-label="t('navigation.home')" size="xl" class="font-bold text-xl dark:text-white">
              <span v-if="!collapsed">{{ companyName }}</span>
            </UButton>
          </UTooltip>
        </div>

        <nav class="space-y-1 px-1">
          <template v-for="link in navigationLinks" :key="link.label">
            <NuxtLink :to="link.to"
              class="flex items-center gap-4 px-4 py-3 rounded-xl dark:text-white/70 hover:dark:text-white hover:bg-white/5 transition-all duration-120"
              :class="{
                'font-semibold dark:text-white bg-white/10': link.active,
                'w-max': collapsed,
                'w-full': !collapsed
              }">
              <UIcon :name="link.icon" class="w-6 h-6 shrink-0" />
              <span v-if="!collapsed" class="text-base truncate">
                {{ link.label }}
              </span>
            </NuxtLink>

            <div v-if="link.children && !collapsed" class="flex flex-col space-y-1 pl-12">
              <NuxtLink v-for="child in link.children" :key="child.label" :to="child.to"
                class="flex items-center gap-3 px-4 py-2 rounded-xl dark:text-white/50 hover:dark:text-white hover:bg-white/5 transition-all duration-120">
                <UIcon :name="child.icon" class="w-4 h-4" />
                <span class="text-sm truncate">{{ child.label }}</span>
              </NuxtLink>
            </div>
          </template>
        </nav>

        <div class="px-2">
          <UButton variant="solid" color="primary" class="rounded-xl w-full grid place-items-center text-base"
            to="/app/posts/new" :label="collapsed ? '' : 'Post'" :icon="collapsed ? 'i-lucide-plus' : undefined" />
        </div>
      </div>

      <div class="space-y-3 pt-4 border-t border-white/10">
        <div v-if="!collapsed" class="flex flex-wrap items-center gap-1 px-2">
          <BaseTranslationMenu />
          <UColorModeButton />
          <UTooltip :text="t('navigation.openOnGitHub')" :kbds="['meta', 'G']">
            <UButton color="neutral" variant="ghost" to="https://github.com/leamsigc/magicsync" target="_blank"
              icon="i-simple-icons-github" :aria-label="t('navigation.openOnGitHub')"
              class="dark:text-white/70 hover:dark:text-white" />
          </UTooltip>
        </div>

        <UDropdownMenu :items="userMenuItems" :ui="{ content: 'bg-elevated rounded-xl ' }">
          <UButton color="neutral" variant="ghost" class="w-full justify-start p-0">
            <div
              class="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors w-full">
              <UAvatar :src="user?.image || ''" :alt="user?.name" size="sm" class="ring-2 ring-white/10" />
              <div v-if="!collapsed" class="flex-1 min-w-0">
                <div class="font-medium text-sm dark:text-white truncate">
                  {{ user?.name || 'User' }}
                </div>
                <div class="text-xs dark:text-white/50 truncate">
                  {{ user?.email || 'email@domain.com' }}
                </div>
              </div>
              <UIcon v-if="!collapsed" name="i-heroicons-ellipsis-horizontal" class="w-5 h-5 dark:text-white/40" />
            </div>
          </UButton>

          <template #account="{ item }">
            <div class="flex items-center gap-3 p-3">
              <UAvatar :src="item.avatar?.src" :alt="item.avatar?.alt" size="2xl" class="ring-2 ring-white/10" />
              <div class="text-left min-w-0 flex-1">
                <p class="truncate font-medium text-sm dark:text-white">{{ item.label }}</p>
                <p class="truncate text-xs dark:text-white/50">{{ item.email }}</p>
              </div>
            </div>
          </template>

          <template #item="{ item }">
            <div class="flex items-center gap-2 px-2 py-1.5 text-sm dark:text-white/70 hover:dark:text-white">
              <UIcon v-if="'icon' in item" :name="item.icon" class="shrink-0 h-4 w-4 dark:text-white/40" />
              <span class="truncate">{{ item.label }}</span>
              <UBadge v-if="'badge' in item" :label="item.badge" variant="subtle" size="xs" class="ml-auto" />
            </div>
          </template>

          <template #item-leading="{ item }">
            <UIcon v-if="'icon' in item" :name="item.icon" class="shrink-0 h-4 w-4 dark:text-white/40" />
          </template>
        </UDropdownMenu>
      </div>
    </div>
  </UScrollArea>
</template>

<style scoped></style>
