<i18n src="./Menu.json"></i18n>
<script lang="ts" setup>
import DashboardUserNav from './UserNav.vue';

const tokenHealthCount = ref(0)

const { checkAndNotify } = useTokenHealthNotification()
callOnce('token-health-notification', async () => {
  const summary = await checkAndNotify()
  if (summary) {
    tokenHealthCount.value = summary.needsAttention
  }
})
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
        <NuxtLink to="/app/integrations" class="relative">
          <UButton icon="i-heroicons-bell" variant="ghost" color="neutral" class="rounded-xl" />
          <span v-if="tokenHealthCount > 0"
            class="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-600 rounded-full animate-pulse">
            {{ tokenHealthCount > 9 ? '9+' : tokenHealthCount }}
          </span>
        </NuxtLink>
        <BaseTranslationMenu />
        <DashboardUserNav collapsed class="max-w-12" />
      </div>
    </div>
  </header>
</template>

<style scoped></style>
