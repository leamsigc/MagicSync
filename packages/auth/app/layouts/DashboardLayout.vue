<script lang="ts" setup>
import DashboardHeader from './dashboard/Header.vue';
import DashboardSidebar from './dashboard/Sidebar.vue';
import UserNav from './dashboard/UserNav.vue';

/**
 *
 * Component Description: Dashboard layout for authenticated users.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *>
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
const items = [
  {
    label: 'Dashboard',
    icon: 'i-heroicons-home',
    to: '/'
  },
  {
    label: 'Settings',
    icon: 'i-heroicons-gear',
    to: '/settings'
  }
]
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar mode="drawer" collapsible resizable class="bg-gray-50 dark:bg-gray-950 max-w-md" :max-size="15"
      :min-size="5" :ui="{ footer: 'p-0' }">
      <template #header="{ collapsed }">
        <NuxtLink v-if="!collapsed" to="/" class="text-xl font-bold text-gray-900 dark:text-white">MagicSync
        </NuxtLink>
        <UIcon v-else name="i-simple-icons-nuxtdotjs" class="size-5 text-primary mx-auto" />
      </template>
      <template #default="{ collapsed }">
        <!-- <UNavigationMenu :items="items" orientation="vertical" /> -->
        <DashboardSidebar :collapsed="collapsed" />
      </template>
      <template #footer="{ collapsed }">
        <UserNav :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>
    <section class="flex flex-1 overflow-hidden">
      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-950">
        <DashboardHeader />
        <div class="p-4 md:p-6">
          <slot />
        </div>
      </main>
    </section>

  </UDashboardGroup>
</template>

<style scoped></style>
