<i18n src="./Menu.json"></i18n>
<script lang="ts" setup>
import DashboardUserNav from './UserNav.vue';
</script>

<template>
  <header class="sticky top-3 z-40 mx-auto px-4">
    <div class="bg-elevated rounded-2xl flex items-center justify-between px-5 py-2.5  max-w-7xl mx-auto">
      <div class="flex items-center space-x-3">
        <UDashboardSidebarToggle class="rounded-xl" />
        <UBreadcrumb
          :links="[{ label: 'Overview' }, { label: 'Customers' }, { label: 'Products' }, { label: 'Settings' }]"
          class="text-sm" />
      </div>
      <div class="flex items-center space-x-2">
        <UInput icon="i-heroicons-magnifying-glass" placeholder="Search..." size="sm" class="hidden md:block" />
        <UColorModeButton />
        <UButton icon="i-heroicons-bell" variant="ghost" color="neutral" class="rounded-xl" />
        <BaseTranslationMenu />
        <DashboardUserNav collapsed class="max-w-12" />
      </div>
    </div>
  </header>
</template>

<style scoped></style>
