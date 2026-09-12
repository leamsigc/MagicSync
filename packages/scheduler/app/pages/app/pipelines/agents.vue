<i18n src="./agents.json"></i18n>

<script lang="ts" setup>
/**
 * Agent Oversight: table of agent_runs (agent, pipeline run, status,
 * tokens, duration) backed by the agent-runs endpoint.
 */
import { usePipelineManager } from './composables/UsePipelineManager'
import type { AgentRun } from '#layers/BaseDB/db/schema'
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import dayjs from 'dayjs'

const { t } = useI18n()
const { agentRunList, fetchAgentRuns, activeBusinessId } = usePipelineManager()

interface ApprovalRow {
  id: string
  artifactId: string
  decision: string
  feedback: string
  actor: string
  version: number
  createdAt: string
}

const statusFilter = ref('')
const approvals = ref<ApprovalRow[]>([])

const statusOptions = computed(() => [
  { label: t('filters.all'), value: '' },
  { label: t('statuses.running'), value: 'running' },
  { label: t('statuses.completed'), value: 'completed' },
  { label: t('statuses.failed'), value: 'failed' },
  { label: t('statuses.cancelled'), value: 'cancelled' },
])

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

useHead({
  title: t('seo_title'),
  meta: [
    { name: 'description', content: t('seo_description') }
  ]
})

const isRefreshing = ref(false)

function statusColor(status: string) {
  if (status === 'completed') return 'success' as const
  if (status === 'failed') return 'error' as const
  if (status === 'cancelled') return 'neutral' as const
  return 'info' as const
}

function formatTokens(run: AgentRun) {
  if (!run.tokensUsed) return t('tokensUnknown')
  return String(run.tokensUsed)
}

function formatCost(run: AgentRun) {
  const cost = (run as AgentRun & { cost?: number | null }).cost
  if (cost === null || cost === undefined) return t('tokensUnknown')
  return String(cost)
}

function formatDuration(run: AgentRun) {
  if (!run.startedAt) return ''
  const end = run.completedAt ? dayjs(run.completedAt) : dayjs()
  const seconds = end.diff(dayjs(run.startedAt), 'second')
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function shortRunId(run: AgentRun) {
  return run.pipelineRunId ? run.pipelineRunId.slice(0, 8) : ''
}

const columns: TableColumn<AgentRun>[] = [
  {
    accessorKey: 'agentName',
    header: () => t('columns.agent'),
    cell: ({ row }) => h('span', { class: 'font-medium' }, row.getValue('agentName') as string)
  },
  {
    accessorKey: 'pipelineRunId',
    header: () => t('columns.run'),
    cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, shortRunId(row.original))
  },
  {
    accessorKey: 'status',
    header: () => t('columns.status'),
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return h(UBadge, { class: 'capitalize', variant: 'subtle', color: statusColor(status) }, () => status)
    }
  },
  {
    accessorKey: 'tokensUsed',
    header: () => t('columns.tokens'),
    cell: ({ row }) => h('span', { class: 'tabular-nums', title: t('tokensHint') }, formatTokens(row.original))
  },
  {
    accessorKey: 'cost',
    header: () => t('columns.cost'),
    cell: ({ row }) => h('span', { class: 'tabular-nums text-muted' }, formatCost(row.original))
  },
  {
    accessorKey: 'startedAt',
    header: () => t('columns.duration'),
    cell: ({ row }) => h('span', { class: 'tabular-nums text-muted' }, formatDuration(row.original))
  },
  {
    accessorKey: 'summary',
    header: () => t('columns.summary'),
    cell: ({ row }) => h('span', { class: 'line-clamp-2 text-toned' }, (row.getValue('summary') as string) || '')
  }
]

async function handleRefresh() {
  isRefreshing.value = true
  try {
    await fetchAgentRuns(undefined, {
      businessId: activeBusinessId.value || undefined,
      status: statusFilter.value || undefined,
    })
    await fetchApprovals()
  }
  finally {
    isRefreshing.value = false
  }
}

async function fetchApprovals() {
  if (!activeBusinessId.value) {
    approvals.value = []
    return
  }
  try {
    const res = await $fetch<{ data?: ApprovalRow[] }>(`/api/v1/artifacts/approvals?businessId=${activeBusinessId.value}`)
    approvals.value = res.data ?? []
  }
  catch {
    approvals.value = []
  }
}

function handleFilterChange() {
  void handleRefresh()
}

onMounted(handleRefresh)
</script>

<template>
  <div class="mx-auto space-y-6">
    <BasePageHeader :title="t('title')" :description="t('description')">
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <USelect
            v-model="statusFilter"
            :items="statusOptions"
            value-key="value"
            data-testid="oversight-status-filter"
            class="min-w-36"
            @update:model-value="handleFilterChange"
          />
          <UButton icon="i-heroicons-arrow-path" color="neutral" variant="outline" :loading="isRefreshing" @click="handleRefresh">
            {{ t('refresh') }}
          </UButton>
        </div>
      </template>
    </BasePageHeader>

    <div v-motion-fade-visible :duration="200" class="rounded overflow-hidden">
      <UTable :data="agentRunList" :columns="columns" class="flex-1" :ui="{ 'tr': 'bg-transparent', 'td': 'border-0', 'th': 'border-0' }" />
      <div v-if="agentRunList.length === 0" class="px-5 py-10 text-sm text-muted text-center">
        {{ t('empty') }}
      </div>
    </div>

    <UCard v-motion-fade-visible :duration="200">
      <template #header>
        <h2 class="font-semibold">{{ t('approvals.title') }}</h2>
      </template>
      <div v-if="approvals.length === 0" class="py-4 text-center text-sm text-muted">
        {{ t('approvals.empty') }}
      </div>
      <ul v-else class="space-y-2">
        <li v-for="approval in approvals" :key="approval.id" class="flex flex-wrap items-center gap-2 rounded-xl bg-elevated p-3 text-xs">
          <UBadge :color="approval.decision === 'approved' ? 'success' : 'warning'" variant="subtle" class="capitalize">
            {{ t(`approvals.${approval.decision}`) }}
          </UBadge>
          <span class="font-mono text-muted">v{{ approval.version }}</span>
          <span class="text-muted">{{ approval.actor }}</span>
          <span v-if="approval.feedback" class="w-full text-toned">{{ approval.feedback }}</span>
        </li>
      </ul>
    </UCard>
  </div>
</template>

<style scoped></style>
