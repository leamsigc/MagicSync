<script lang="ts" setup>
import DashboardHeader from './dashboard/Header.vue';
import DashboardSidebar from './dashboard/Sidebar.vue';
import UserNav from './dashboard/UserNav.vue';
</script>

<template>
  <div class="min-h-screen">
    <UDashboardGroup>
      <UDashboardSidebar mode="drawer" collapsible resizable
        class=" rounded-2xl m-3 h-[calc(100vh-1.5rem)] border border-white/10" :max-size="15" :min-size="5"
        :ui="{ footer: 'p-0' }">
        <template #header="{ collapsed }">
          <NuxtLink v-if="!collapsed" to="/" class="text-xl font-bold dark:text-white px-2">MagicSync</NuxtLink>
          <UIcon v-else name="i-simple-icons-nuxtdotjs" class="size-5 text-primary mx-auto" />
        </template>
        <template #default="{ collapsed }">
          <DashboardSidebar :collapsed="collapsed" />
        </template>
        <template #footer="{ collapsed }">
          <UserNav :collapsed="collapsed" />
        </template>
      </UDashboardSidebar>

      <section class="flex flex-1 overflow-hidden">
        <main class="flex-1 overflow-x-hidden overflow-y-auto">
          <DashboardHeader />
          <div class="p-4 md:p-6">
            <slot />
          </div>
        </main>
      </section>
    </UDashboardGroup>
  </div>
</template>

<style scoped></style>
