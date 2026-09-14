<i18n src="../../pipelines.json"></i18n>

<script lang="ts" setup>
/**
 * Pipeline Runs Table View: flat list of tracked runs with status badges.
 */
import type { PipelineRun } from '#layers/BaseDB/db/schema'
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import dayjs from 'dayjs'

const { t } = useI18n()

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

defineProps<{
  runs: PipelineRun[]
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()

const router = useRouter()
function openRun(id: string) {
  router.push(`/app/pipelines/runs/${id}`)
}

function statusColor(status: string) {
  if (status === 'completed') return 'success' as const
  if (status === 'failed') return 'error' as const
  if (status === 'waiting_input') return 'warning' as const
  return 'info' as const
}

const columns: TableColumn<PipelineRun>[] = [
  {
    accessorKey: 'id',
    header: () => t('table.columns.run'),
    cell: ({ row }) => {
      const id = row.getValue('id') as string
      return h('button', {
        class: 'text-left hover:underline text-default cursor-pointer font-mono',
        type: 'button',
        onClick: () => openRun(row.original.id)
      }, id.slice(0, 8))
    }
  },
  {
    accessorKey: 'pipelineId',
    header: () => t('table.columns.pipeline'),
    cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, (row.getValue('pipelineId') as string).slice(0, 8))
  },
  {
    accessorKey: 'status',
    header: () => t('table.columns.status'),
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return h(UBadge, { class: 'capitalize', variant: 'subtle', color: statusColor(status) }, () => t(`statuses.${status}`))
    }
  },
  {
    accessorKey: 'currentStep',
    header: () => t('table.columns.step'),
    cell: ({ row }) => h('span', {}, t('board.step', { current: (row.getValue('currentStep') as number) + 1, total: 5 }))
  },
  {
    accessorKey: 'updatedAt',
    header: () => t('table.columns.updated'),
    cell: ({ row }) => h('span', { class: 'text-muted' }, dayjs(row.getValue('updatedAt') as string).format('MMM DD, HH:mm'))
  },
  {
    id: 'actions',
    header: () => t('table.columns.actions'),
    cell: ({ row }) => h('div', { class: 'flex items-center gap-1' }, [
      h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        size: 'xs',
        onClick: () => openRun(row.original.id)
      }, () => t('table.view')),
      h(UButton, {
        color: 'error',
        variant: 'ghost',
        size: 'xs',
        icon: 'i-heroicons-trash',
        title: t('runDelete.button'),
        'aria-label': t('runDelete.button'),
        onClick: () => emit('delete', row.original.id)
      })
    ])
  }
]
</script>

<template>
  <div class="mt-4" v-motion-fade-visible :duration="200">
    <div class="rounded overflow-hidden border border-white/10 bg-[#111111]">
      <UTable :data="runs" :columns="columns" class="flex-1" :ui="{ 'tr': 'bg-transparent', 'td': 'border-0', 'th': 'border-0' }" />
      <div v-if="runs.length === 0" class="px-5 py-10 text-sm text-white/20 text-center">
        {{ t('table.empty') }}
      </div>
    </div>
  </div>
</template>

<style scoped></style>
