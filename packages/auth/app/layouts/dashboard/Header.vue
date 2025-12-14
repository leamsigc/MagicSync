<!--  Translation file -->
<i18n src="./Menu.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: Header navigation for the dashboard.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *>
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import DashboardUserNav from './UserNav.vue';
const { t } = useI18n();
</script>

<template>
  <header class="flex items-center justify-between px-6 py-4 ">
    <div class="flex items-center space-x-4">
      <UDashboardSidebarToggle />
      <UBreadcrumb
        :links="[{ label: 'Overview' }, { label: 'Customers' }, { label: 'Products' }, { label: 'Settings' }]" />
    </div>
    <div class="flex items-center space-x-4">
      <UInput icon="i-heroicons-magnifying-glass" placeholder="Search..." class="hidden md:block" />
      <UColorModeButton />
      <UButton icon="i-heroicons-bell" variant="ghost" />


      <BaseTranslationMenu />
      <DashboardUserNav collapsed class="max-w-12" />
    </div>
  </header>
</template>

<style scoped></style>
