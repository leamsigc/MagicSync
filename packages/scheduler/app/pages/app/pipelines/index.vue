<i18n src="./pipelines.json"></i18n>

<script lang="ts" setup>
/**
 * Pipelines overview: pipeline selector, run-status board + table toggle,
 * and the start-run entry point for the content workflow.
 */
import { usePipelineManager } from './composables/UsePipelineManager'
import StartRunModal from './components/StartRunModal.vue'
import PipelineRunsBoardView from './components/views/PipelineRunsBoardView.vue'
import PipelineRunsTableView from './components/views/PipelineRunsTableView.vue'

const activeBusinessId = useState<string>('business:id')
const { pipelineList, runList, fetchPipelines, fetchRuns, deletePipeline, deleteRun, t } = usePipelineManager()
const router = useRouter()
const toast = useToast()
const deleteOpen = ref(false)
const deleting = ref(false)
const runDeleteOpen = ref(false)
const runDeleteTarget = ref('')
const deletingRun = ref(false)

useHead({
  title: t('seo_title'),
  meta: [
    { name: 'description', content: t('seo_description') }
  ]
})

const currentView = ref<'Board' | 'Table'>('Board')
const selectedPipelineId = ref('')

const pipelineItems = computed(() => pipelineList.value.map(pipeline => ({
  label: pipeline.name,
  value: pipeline.id
})))

const selectedPipeline = computed(() => {
  const found = pipelineList.value.find(pipeline => pipeline.id === selectedPipelineId.value)
  return found ?? pipelineList.value[0] ?? null
})

const visibleRuns = computed(() => {
  if (!selectedPipeline.value) return runList.value
  return runList.value.filter(run => run.pipelineId === selectedPipeline.value?.id)
})

function setView(view: 'Board' | 'Table') {
  currentView.value = view
}

function handlePipelineSelect(id: string) {
  selectedPipelineId.value = id
}

function handleOpenStudio() {
  const target = selectedPipeline.value?.id ?? pipelineList.value[0]?.id
  router.push(target ? { path: '/app/pipelines/studio', query: { pipeline: target } } : '/app/pipelines/studio')
}

function handleAskDelete() {
  if (!selectedPipeline.value) {
    return
  }
  deleteOpen.value = true
}

function handleCloseDelete() {
  deleteOpen.value = false
}

async function handleConfirmDelete() {
  const target = selectedPipeline.value
  if (!target) {
    return
  }
  deleting.value = true
  try {
    await deletePipeline(target.id)
    selectedPipelineId.value = ''
    handleCloseDelete()
  }
  finally {
    deleting.value = false
  }
}

function handleAskDeleteRun(id: string) {
  runDeleteTarget.value = id
  runDeleteOpen.value = true
}

function handleCloseDeleteRun() {
  runDeleteOpen.value = false
  runDeleteTarget.value = ''
}

async function handleConfirmDeleteRun() {
  if (!runDeleteTarget.value) {
    return
  }
  deletingRun.value = true
  try {
    await deleteRun(runDeleteTarget.value)
    handleCloseDeleteRun()
  }
  finally {
    deletingRun.value = false
  }
}

onMounted(async () => {
  if (activeBusinessId.value) {
    await fetchPipelines(activeBusinessId.value)
    await fetchRuns(activeBusinessId.value)
  }
})
</script>

<template>
  <div class="min-h-screen ">
    <header class="sticky top-0 z-40 border-b border-white/5  backdrop-blur-xl">
      <div class="mx-auto p-2 lg:p-6 flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold text-white/90">{{ t('title') }}</h1>
          <p class="text-xs text-white/40">{{ t('description') }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton color="neutral" variant="outline" icon="i-heroicons-squares-2x2" data-testid="open-studio"
            @click="handleOpenStudio" class="border-white/10 text-white/50">
            {{ t('studio.open') }}
          </UButton>
          <StartRunModal />
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-6 py-6 space-y-6">
      <div
        class="p-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#111111] border border-white/5 p-4">
        <section class="flex items-center gap-3">
          <span class="text-sm text-white/40">{{ t('selector.label') }}</span>
          <USelect :model-value="selectedPipeline?.id ?? ''" :items="pipelineItems"
            :placeholder="t('selector.placeholder')" class="min-w-64" @update:model-value="handlePipelineSelect" />
          <UButton v-if="selectedPipeline" color="error" variant="ghost" size="sm" icon="i-heroicons-trash"
            :title="t('delete.button')" @click="handleAskDelete" class="text-white/30" />
        </section>

        <section class="flex gap-1 rounded-lg bg-white/5 p-1">
          <UButton icon="i-heroicons-squares-2x2" :variant="currentView === 'Board' ? 'solid' : 'ghost'" size="sm"
            class="rounded-lg" @click="setView('Board')">
            {{ t('view.board') }}
          </UButton>
          <UButton icon="i-heroicons-table-cells" :variant="currentView === 'Table' ? 'solid' : 'ghost'" size="sm"
            class="rounded-lg" @click="setView('Table')">
            {{ t('view.table') }}
          </UButton>
        </section>
      </div>

      <div v-if="currentView === 'Board'" v-motion-fade-visible :duration="200" :key="`board-${selectedPipeline?.id}`">
        <PipelineRunsBoardView :runs="visibleRuns" :pipeline-name="selectedPipeline?.name ?? ''"
          @delete="handleAskDeleteRun" />
      </div>

      <div v-if="currentView === 'Table'" v-motion-fade-visible :duration="200" :key="`table-${selectedPipeline?.id}`">
        <PipelineRunsTableView :runs="visibleRuns" @delete="handleAskDeleteRun" />
      </div>

      <UModal v-model:open="deleteOpen" :title="t('delete.title')"
        :description="t('delete.description', { name: selectedPipeline?.name ?? '' })">
        <template #footer>
          <div class="flex flex-wrap justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="handleCloseDelete">
              {{ t('delete.cancel') }}
            </UButton>
            <UButton color="error" variant="solid" icon="i-heroicons-trash" :loading="deleting"
              @click="handleConfirmDelete">
              {{ t('delete.confirm') }}
            </UButton>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="runDeleteOpen" :title="t('runDelete.title')"
        :description="t('runDelete.description', { name: runDeleteTarget.slice(0, 8) })">
        <template #footer>
          <div class="flex flex-wrap justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="handleCloseDeleteRun">
              {{ t('runDelete.cancel') }}
            </UButton>
            <UButton color="error" variant="solid" icon="i-heroicons-trash" :loading="deletingRun"
              @click="handleConfirmDeleteRun">
              {{ t('runDelete.confirm') }}
            </UButton>
          </div>
        </template>
      </UModal>
    </main>
  </div>
</template>

<style scoped></style>
