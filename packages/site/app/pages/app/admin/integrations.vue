<script lang="ts" setup>
definePageMeta({
  layout: 'dashboard-layout'
})

interface IntegrationStat {
  providerId: string
  count: number
}

const integrations = ref<IntegrationStat[]>([])
const loading = ref(true)

const platformLabels: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  discord: 'Discord',
  reddit: 'Reddit',
  linkedin: 'LinkedIn',
  'linkedin-page': 'LinkedIn Page',
  tiktok: 'TikTok',
  twitter: 'Twitter / X',
  youtube: 'YouTube',
  threads: 'Threads',
  dribbble: 'Dribbble',
  instagram: 'Instagram',
  wordpress: 'WordPress',
  canva: 'Canva',
  'email-password': 'Email / Password'
}

const platformIcons: Record<string, string> = {
  google: 'lucide:search',
  facebook: 'lucide:facebook',
  twitter: 'lucide:twitter',
  linkedin: 'lucide:linkedin',
  instagram: 'lucide:instagram',
  youtube: 'lucide:youtube',
  tiktok: 'lucide:music',
  threads: 'lucide:message-circle',
  discord: 'lucide:message-square',
  reddit: 'lucide:message-circle',
  dribbble: 'lucide:basketball',
  wordpress: 'lucide:globe',
  canva: 'lucide:palette'
}

async function fetchIntegrations() {
  loading.value = true
  try {
    const data = await $fetch<{ integrations: IntegrationStat[] }>('/api/v1/admin/integrations')
    integrations.value = data.integrations
  } catch {
    console.error('Failed to load integrations')
  } finally {
    loading.value = false
  }
}

onMounted(fetchIntegrations)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Integrations</h1>
      <p class="text-muted-foreground">Monitor platform connections across all users</p>
    </div>

    <UCard v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-muted-foreground" />
    </UCard>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <UCard v-for="item in integrations" :key="item.providerId" class="hover:border-primary/50 transition-colors">
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-lg bg-primary/10">
            <UIcon :name="platformIcons[item.providerId] || 'lucide:plug'" class="w-6 h-6 text-primary" />
          </div>
          <div>
            <p class="font-medium">{{ platformLabels[item.providerId] || item.providerId }}</p>
            <p class="text-2xl font-bold">{{ item.count }}</p>
            <p class="text-xs text-muted-foreground">{{ item.count === 1 ? 'connection' : 'connections' }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <div v-if="!loading && integrations.length === 0" class="text-center py-12 text-muted-foreground">
      No integrations found
    </div>
  </div>
</template>
