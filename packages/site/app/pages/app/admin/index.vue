<i18n src="./index.json"></i18n>

<script lang="ts" setup>
definePageMeta({
  layout: 'dashboard-layout',
})

const { t } = useI18n()
const toast = useToast()

useHead(() => ({
  title: t('title'),
  meta: [{ name: 'description', content: t('metaDescription') }],
}))

const stats = ref([
  { labelKey: 'stats.users', value: '—', icon: 'lucide:users' },
  { labelKey: 'stats.businesses', value: '—', icon: 'lucide:building-2' },
  { labelKey: 'stats.posts', value: '—', icon: 'lucide:clipboard-list' },
  { labelKey: 'stats.sessions', value: '—', icon: 'lucide:activity' },
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
      { labelKey: 'stats.users', value: String(data.users), icon: 'lucide:users' },
      { labelKey: 'stats.businesses', value: String(data.businesses), icon: 'lucide:building-2' },
      { labelKey: 'stats.posts', value: String(data.posts), icon: 'lucide:clipboard-list' },
      { labelKey: 'stats.sessions', value: String(data.sessions), icon: 'lucide:activity' },
    ]
  } catch {
    toast.add({ title: t('toasts.loadFailed'), color: 'error' })
  }
})

const adminLinks = [
  { labelKey: 'links.users', to: '/app/admin/users', icon: 'lucide:users', descriptionKey: 'links.usersDescription' },
  { labelKey: 'links.businesses', to: '/app/admin/businesses', icon: 'lucide:building-2', descriptionKey: 'links.businessesDescription' },
  { labelKey: 'links.integrations', to: '/app/admin/integrations', icon: 'lucide:plug', descriptionKey: 'links.integrationsDescription' },
  { labelKey: 'links.announcements', to: '/app/admin/announcements', icon: 'lucide:megaphone', descriptionKey: 'links.announcementsDescription' },
  { labelKey: 'links.feedback', to: '/app/admin/feedbacks', icon: 'lucide:message-square-heart', descriptionKey: 'links.feedbackDescription' },
  { labelKey: 'links.audit', to: '/app/admin/audit', icon: 'lucide:scroll-text', descriptionKey: 'links.auditDescription' },
  { labelKey: 'links.posts', to: '/app/admin/posts', icon: 'lucide:clipboard-list', descriptionKey: 'links.postsDescription' },
  { labelKey: 'links.data', to: '/app/admin/data', icon: 'lucide:database', descriptionKey: 'links.dataDescription' },
]
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ t('title') }}</h1>
      <p class="text-muted-foreground">{{ t('subtitle') }}</p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="admin-step-0">
      <div v-for="stat in stats" :key="stat.labelKey" class="rounded p-4">
        <div class="flex items-center gap-3">
          <div class="rounded-lg bg-primary/10 p-2">
            <UIcon :name="stat.icon" class="h-5 w-5 text-primary" />
          </div>
          <div>
            <p class="text-2xl font-bold">{{ stat.value }}</p>
            <p class="text-sm text-muted-foreground">{{ t(stat.labelKey) }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2" data-tour="admin-step-1">
      <NuxtLink
        v-for="link in adminLinks"
        :key="link.to"
        :to="link.to"
        class="block rounded-2xl bg-elevated p-4 transition-shadow hover:shadow-lg"
      >
        <div class="flex items-center gap-3">
          <div class="rounded-lg bg-primary/10 p-2">
            <UIcon :name="link.icon" class="h-5 w-5 text-primary" />
          </div>
          <div>
            <p class="font-medium">{{ t(link.labelKey) }}</p>
            <p class="text-sm text-muted-foreground">{{ t(link.descriptionKey) }}</p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
