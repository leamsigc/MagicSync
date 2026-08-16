<script lang="ts" setup>
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  layout: 'dashboard-layout'
})

const UAvatar = resolveComponent('UAvatar')
const UIcon = resolveComponent('UIcon')

const toast = useToast()

interface AdminConnection {
  id: string
  providerId: string
  accountId: string
  createdAt: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

const connections = ref<AdminConnection[]>([])
const loading = ref(true)
const viewMode = ref<'cards' | 'table'>('cards')

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

async function fetchConnections() {
  loading.value = true
  try {
    const data = await $fetch<{ connections: AdminConnection[] }>('/api/v1/admin/connections')
    connections.value = data.connections
  } catch {
    toast.add({ title: 'Error', description: 'Failed to load connections', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(fetchConnections)

function providerLabel(providerId: string) {
  return platformLabels[providerId] || providerId
}

function providerIcon(providerId: string) {
  return platformIcons[providerId] || 'lucide:plug'
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

const columns: TableColumn<AdminConnection>[] = [
  {
    accessorKey: 'providerId',
    header: 'Platform',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2' }, [
        h('span', { class: 'p-2 rounded-lg bg-primary/10 text-primary inline-flex' }, [
          h(UIcon, { name: providerIcon(row.original.providerId), class: 'w-4 h-4' })
        ]),
        h('span', { class: 'text-sm' }, providerLabel(row.original.providerId))
      ])
  },
  {
    accessorKey: 'userEmail',
    header: 'User',
    cell: ({ row }) => {
      const conn = row.original
      return h('div', { class: 'flex items-center gap-3' }, [
        h(UAvatar, { src: conn.userImage || undefined, alt: conn.userName || conn.userEmail || 'User', size: 'sm' }),
        h('div', null, [
          h('p', { class: 'font-medium text-sm' }, conn.userName || 'Unnamed'),
          h('p', { class: 'text-xs text-muted-foreground' }, conn.userEmail || '—')
        ])
      ])
    }
  },
  {
    accessorKey: 'accountId',
    header: 'Account ID',
    cell: ({ row }) => h('span', { class: 'text-xs font-mono text-muted-foreground' }, row.original.accountId)
  },
  {
    accessorKey: 'createdAt',
    header: 'Connected',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, formatDate(row.original.createdAt))
  }
]
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Integrations</h1>
        <p class="text-muted-foreground">Monitor platform connections and their users</p>
      </div>
      <UButtonGroup size="sm">
        <UButton
          :variant="viewMode === 'cards' ? 'solid' : 'outline'"
          icon="i-lucide-layout-grid"
          @click="() => { viewMode = 'cards' }"
        >
          Cards
        </UButton>
        <UButton
          :variant="viewMode === 'table' ? 'solid' : 'outline'"
          icon="i-lucide-table"
          @click="() => { viewMode = 'table' }"
        >
          Table
        </UButton>
      </UButtonGroup>
    </div>

    <div v-if="loading" class="bg-elevated rounded-2xl flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="connections.length === 0" class="bg-elevated rounded-2xl text-center py-12 text-muted-foreground">
      No connections found
    </div>

    <div v-else-if="viewMode === 'cards'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="conn in connections" :key="conn.id" class="bg-elevated rounded-2xl p-4 hover:shadow-lg transition-shadow">
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-lg bg-primary/10">
            <UIcon :name="providerIcon(conn.providerId)" class="w-6 h-6 text-primary" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-medium">{{ providerLabel(conn.providerId) }}</p>
            <p class="text-xs text-muted-foreground truncate">Account: {{ conn.accountId }}</p>
          </div>
        </div>
        <div class="mt-3 pt-3 border-t border-border/50 flex items-center gap-3">
          <UAvatar :src="conn.userImage || undefined" :alt="conn.userName || conn.userEmail || 'User'" size="sm" />
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">{{ conn.userName || 'Unnamed' }}</p>
            <p class="text-xs text-muted-foreground truncate">{{ conn.userEmail || '—' }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="bg-elevated rounded-2xl overflow-hidden">
      <UTable :data="connections" :columns="columns" class="flex-1" />
    </div>
  </div>
</template>
