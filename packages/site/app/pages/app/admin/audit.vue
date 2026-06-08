<script lang="ts" setup>
definePageMeta({
  layout: 'dashboard-layout'
})

const toast = useToast()

interface AuditEntry {
  id: number
  userId: string | null
  category: string
  action: string
  targetType: string | null
  targetId: string | null
  ipAddress: string | null
  userAgent: string | null
  status: string | null
  details: string | null
  createdAt: string
}

const logs = ref<AuditEntry[]>([])
const loading = ref(true)
const selectedLog = ref<AuditEntry | null>(null)
const showDetail = computed({
  get: () => !!selectedLog.value,
  set: (val) => { if (!val) selectedLog.value = null }
})

const statusColor: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  success: 'success',
  failure: 'error',
  pending: 'warning'
}

async function fetchLogs() {
  loading.value = true
  try {
    const data = await $fetch<{ logs: AuditEntry[] }>('/api/v1/admin/audit-log')
    logs.value = data.logs
  } catch {
    toast.add({ title: 'Error', description: 'Failed to load audit log', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(fetchLogs)
</script>

<template>
  <div class="space-y-6">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold tracking-tight">Audit Log</h1>
            <p class="text-muted-foreground">Review system activity and events</p>
          </div>
          <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-arrow-path" @click="fetchLogs">
            Refresh
          </UButton>
        </div>
      </template>

      <div v-if="loading" class="flex justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-muted-foreground" />
      </div>

      <div v-else-if="logs.length === 0" class="text-center py-12 text-muted-foreground">
        No log entries found
      </div>

      <table v-else class="w-full">
        <thead>
          <tr class="border-b border-border text-left">
            <th class="py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</th>
            <th class="py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
            <th class="py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
            <th class="py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
            <th class="py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id" class="border-b border-border hover:bg-muted/50 cursor-pointer" @click="selectedLog = log">
            <td class="py-2 px-3">
              <span class="text-xs text-muted-foreground">{{ new Date(log.createdAt).toLocaleString() }}</span>
            </td>
            <td class="py-2 px-3">
              <span class="text-xs font-mono">{{ log.category }}</span>
            </td>
            <td class="py-2 px-3">
              <span class="text-sm">{{ log.action }}</span>
            </td>
            <td class="py-2 px-3">
              <UBadge :color="statusColor[log.status || ''] || 'neutral'" variant="subtle" size="sm">
                {{ log.status }}
              </UBadge>
            </td>
            <td class="py-2 px-3">
              <span class="text-xs text-muted-foreground truncate block max-w-[200px]">{{ log.details }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <UModal v-model:open="showDetail"  :ui="{ content: 'md:min-w-[900px]' }">
      <template #content>
        <UCard v-if="selectedLog" >
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">Log Details</h3>
              <UButton variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="selectedLog = null" />
            </div>
          </template>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-muted-foreground">ID</dt>
              <dd class="font-mono">{{ selectedLog.id }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Category</dt>
              <dd>{{ selectedLog.category }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Action</dt>
              <dd>{{ selectedLog.action }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Status</dt>
              <dd>
                <UBadge :color="statusColor[selectedLog.status || ''] || 'neutral'" variant="subtle" size="sm">
                  {{ selectedLog.status }}
                </UBadge>
              </dd>
            </div>
            <div v-if="selectedLog.targetType" class="flex justify-between">
              <dt class="text-muted-foreground">Target</dt>
              <dd class="font-mono text-xs break-all">
                {{ selectedLog.targetType }}:
                {{ selectedLog.targetId }}
              </dd>
            </div>
            <div v-if="selectedLog.userId" class="flex justify-between">
              <dt class="text-muted-foreground">User ID</dt>
              <dd class="font-mono text-xs">{{ selectedLog.userId }}</dd>
            </div>
            <div v-if="selectedLog.details" class="pt-2">
              <dt class="text-muted-foreground mb-1">Details</dt>
              <dd class="bg-muted p-3 rounded-lg text-xs font-mono whitespace-pre-wrap">{{ selectedLog.details }}</dd>
            </div>
            <div v-if="selectedLog.ipAddress" class="flex justify-between">
              <dt class="text-muted-foreground">IP Address</dt>
              <dd class="font-mono text-xs">{{ selectedLog.ipAddress }}</dd>
            </div>
          </dl>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
