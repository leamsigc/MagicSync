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
const { pipelineList, runList, fetchPipelines, fetchRuns, deletePipeline, t } = usePipelineManager()
const router = useRouter()
const toast = useToast()
const deleteOpen = ref(false)
const deleting = ref(false)

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

onMounted(async () => {
  if (activeBusinessId.value) {
    await fetchPipelines(activeBusinessId.value)
    await fetchRuns(activeBusinessId.value)
  }
})
</script>

<template>
  <div class="mx-auto space-y-6">
    <BasePageHeader :title="t('title')" :description="t('description')">
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <UButton color="neutral" variant="outline" icon="i-heroicons-squares-2x2" data-testid="open-studio" @click="handleOpenStudio">
            {{ t('studio.open') }}
          </UButton>
          <StartRunModal />
        </div>
      </template>
    </BasePageHeader>

    <div class="p-2 flex flex-wrap justify-between items-center gap-3">
      <section class="flex items-center gap-2">
        <span class="text-sm text-muted">{{ t('selector.label') }}</span>
        <USelect
          :model-value="selectedPipeline?.id ?? ''"
          :items="pipelineItems"
          :placeholder="t('selector.placeholder')"
          class="min-w-56"
          @update:model-value="handlePipelineSelect"
        />
        <UButton
          v-if="selectedPipeline"
          color="error"
          variant="ghost"
          size="sm"
          icon="i-heroicons-trash"
          :title="t('delete.button')"
          @click="handleAskDelete"
        />
      </section>

      <section class="flex gap-1">
        <UButton icon="i-heroicons-squares-2x2" :variant="currentView === 'Board' ? 'solid' : 'ghost'" size="sm" class="rounded-xl" @click="setView('Board')">
          {{ t('view.board') }}
        </UButton>
        <UButton icon="i-heroicons-table-cells" :variant="currentView === 'Table' ? 'solid' : 'ghost'" size="sm" class="rounded-xl" @click="setView('Table')">
          {{ t('view.table') }}
        </UButton>
      </section>
    </div>

    <div v-if="currentView === 'Board'" v-motion-fade-visible :duration="200" :key="`board-${selectedPipeline?.id}`">
      <PipelineRunsBoardView :runs="visibleRuns" :pipeline-name="selectedPipeline?.name ?? ''" />
    </div>

    <div v-if="currentView === 'Table'" v-motion-fade-visible :duration="200" :key="`table-${selectedPipeline?.id}`">
      <PipelineRunsTableView :runs="visibleRuns" />
    </div>

    <UModal v-model:open="deleteOpen" :title="t('delete.title')" :description="t('delete.description', { name: selectedPipeline?.name ?? '' })">
      <template #footer>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="handleCloseDelete">
            {{ t('delete.cancel') }}
          </UButton>
          <UButton color="error" variant="solid" icon="i-heroicons-trash" :loading="deleting" @click="handleConfirmDelete">
            {{ t('delete.confirm') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped></style>
