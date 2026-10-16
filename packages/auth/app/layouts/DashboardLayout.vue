<script lang="ts" setup>
import DashboardHeader from './dashboard/Header.vue';
import DashboardSidebar from './dashboard/Sidebar.vue';
import UserNav from './dashboard/UserNav.vue';

const { checkAndNotify } = useTokenHealthNotification()
// Client-only: during SSR there is no session cookie, so the check would
// 401 against our own API on every first paint (caught, but noisy). The
// browser run right after hydration covers it.
if (import.meta.client) {
  await callOnce('token-health-notification', () => checkAndNotify());
}
</script>

<template>
  <div class="min-h-screen">
    <UDashboardGroup>
      <UDashboardSidebar mode="drawer" collapsible resizable
        class=" rounded-2xl m-3 h-[calc(100vh-1.5rem)] border border-white/10" :max-size="15" :min-size="5"
        :ui="{ footer: 'p-0' }">
        <template #header="{ collapsed }">
          <NuxtLink to="/" class="text-xl font-bold dark:text-white flex items-center  w-full"
            :class="{ 'px-2': !collapsed, 'justify-center': collapsed }">
            <img src="/img/logo.png" alt="MagicSync" title="MagicSync" class="size-[40px] max-w-max">
            <span v-if="!collapsed">
              MagicSync
            </span>
          </NuxtLink>
        </template>
        <template #default="{ collapsed }">
          <DashboardSidebar :collapsed="collapsed" />
        </template>
        <template #footer="{ collapsed }">
          <UserNav :collapsed="collapsed" class="mb-5" />
        </template>
      </UDashboardSidebar>

      <section class="flex flex-1 overflow-hidden">
        <main class="flex-1 overflow-x-hidden overflow-y-auto">
          <ImpersonationBanner />
          <DashboardHeader />
          <FeedbackFab />
          <div class="p-0 md:p-0">
            <slot />
          </div>
        </main>
      </section>
    </UDashboardGroup>
  </div>
</template>

<style scoped></style>
