<i18n src="./Menu.json"></i18n>
<script lang="ts" setup>
import DashboardUserNav from './UserNav.vue';
import BusinessSwitcher from './BusinessSwitcher.vue';

const { t, currentPageTitle } = useDashboardNavigation()

// The dashboard layout owns the single health check; this badge only reads the
// shared summary state it writes (`token-health:needsAttention`). Running a
// second callOnce here duplicated a ~400 KB request on every page load.
const { needsAttention } = useTokenHealthNotification()
</script>

<template>
  <header class="sticky top-3 z-40 mx-auto px-4">
    <div class="rounded flex items-center justify-between px-5 py-2.5  max-w-7xl mx-auto">
      <div class="flex items-center space-x-3">
        <UDashboardSidebarToggle class="rounded-xl" />
        <UDashboardSidebarCollapse class="hidden lg:flex" />
        <span class="truncate text-sm font-semibold text-highlighted">{{ currentPageTitle }}</span>
      </div>
      <div class="flex min-w-0 items-center space-x-2">
        <BusinessSwitcher class="max-w-[8rem] truncate sm:max-w-none" />
        <UInput icon="i-heroicons-magnifying-glass" :placeholder="t('menu.search')" size="sm" class="hidden md:block" />
        <!-- Color mode and language move to the drawer footer on a phone; the
             header only has room for the business, alerts and the account. -->
        <UColorModeButton class="hidden sm:inline-flex" />
        <NuxtLink to="/app/notifications" :title="t('menu.notification')" class="relative">
          <UButton icon="i-heroicons-bell" variant="ghost" color="neutral" class="rounded-xl" />
          <span v-if="needsAttention > 0"
            class="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-600 rounded-full animate-pulse">
            {{ needsAttention > 9 ? '9+' : needsAttention }}
          </span>
        </NuxtLink>
        <BaseTranslationMenu class="hidden sm:block" />
        <DashboardUserNav collapsed class="max-w-12" />
      </div>
    </div>
  </header>
</template>

<style scoped></style>
