<script lang="ts" setup>
definePageMeta({
  layout: 'dashboard-layout'
})

const { t } = useI18n()

useHead({
  title: 'Admin Dashboard',
  meta: [{ name: 'description', content: 'Administration dashboard' }]
})

const stats = ref([
  { label: 'Total Users', value: '—', icon: 'lucide:users' },
  { label: 'Total Businesses', value: '—', icon: 'lucide:building-2' },
  { label: 'Total Posts', value: '—', icon: 'lucide:clipboard-list' },
  { label: 'Active Sessions', value: '—', icon: 'lucide:activity' }
])

onMounted(async () => {
  try {
    const data = await $fetch<{
      users: number
      businesses: number
      posts: number
      sessions: number
    }>('/api/v1/admin/stats')
    stats.value = [
      { label: 'Total Users', value: String(data.users), icon: 'lucide:users' },
      { label: 'Total Businesses', value: String(data.businesses), icon: 'lucide:building-2' },
      { label: 'Total Posts', value: String(data.posts), icon: 'lucide:clipboard-list' },
      { label: 'Active Sessions', value: String(data.sessions), icon: 'lucide:activity' }
    ]
  } catch {
    console.error('Failed to load admin stats')
  }
})

const adminLinks = [
  { label: 'Users', to: '/app/admin/users', icon: 'lucide:users', description: 'Manage user accounts and roles' },
  { label: 'Businesses', to: '/app/admin/businesses', icon: 'lucide:building-2', description: 'View and manage all businesses' },
  { label: 'Integrations', to: '/app/admin/integrations', icon: 'lucide:plug', description: 'Monitor platform connections' },
  { label: 'Audit Log', to: '/app/admin/audit', icon: 'lucide:scroll-text', description: 'Review system activity logs' }
]
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
      <p class="text-muted-foreground">System overview and administration</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard v-for="stat in stats" :key="stat.label">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-primary/10">
            <UIcon :name="stat.icon" class="w-5 h-5 text-primary" />
          </div>
          <div>
            <p class="text-2xl font-bold">{{ stat.value }}</p>
            <p class="text-sm text-muted-foreground">{{ stat.label }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NuxtLink v-for="link in adminLinks" :key="link.to" :to="link.to"
        class="block p-4 rounded-xl border border-border hover:border-primary/50 transition-colors bg-card">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-primary/10">
            <UIcon :name="link.icon" class="w-5 h-5 text-primary" />
          </div>
          <div>
            <p class="font-medium">{{ link.label }}</p>
            <p class="text-sm text-muted-foreground">{{ link.description }}</p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
