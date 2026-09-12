<i18n src="./studio.json"></i18n>

<script lang="ts" setup>
/**
 * Pipeline studio: visual flow editor for content pipelines.
 * Palette (drag + click-to-add), Vue Flow canvas with custom nodes,
 * inspector for the selected node, save/run via the pipeline API.
 */
import { VueFlow, useVueFlow, Handle, Position } from '@vue-flow/core'
import type { Node as FlowNode, Edge as FlowEdge, Connection } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import type { PipelineStep } from '#layers/BaseDB/db/schema'
import { usePipelineManager } from './composables/UsePipelineManager'
import {
  NODE_CATALOG,
  NODE_CATEGORIES,
  buildSteps,
  connectionError,
  isActionKind,
  isPhaseKind,
  isTriggerKind,
  linearize,
  nodeDefOf,
  parseStepsToGraph,
  validateGraph,
  fallbackPosition,
  type StudioGraphEdge,
  type StudioGraphNode,
  type StudioNodeDef
} from './composables/studioLib'

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const { project, fitView } = useVueFlow()
const activeBusinessId = useState<string>('business:id')
const { pipelineList, fetchPipelines, getPipeline, createPipeline, updatePipeline, startRun, saveGraph, activatePipeline, archivePipeline, clonePipeline } = usePipelineManager()

useHead({
  title: t('seo_title'),
  meta: [
    { name: 'description', content: t('seo_description') }
  ]
})

const nodes = ref<FlowNode[]>([])
const edges = ref<FlowEdge[]>([])
const selectedId = ref<string | null>(null)
const pipelineId = ref('')
const newPipelineName = ref('')
const saving = ref(false)
const running = ref(false)
const creating = ref(false)
const loadingCanvas = ref(false)
const flowWrap = ref<HTMLElement | null>(null)
let nodeCounter = 0

const graphNodes = computed<StudioGraphNode[]>(() => nodes.value.map(node => ({
  id: node.id,
  kind: String(node.data?.kind ?? 'custom'),
  name: String(node.data?.name ?? node.id),
  prompt: String(node.data?.prompt ?? ''),
  config: (node.data?.config ?? {}) as Record<string, unknown>,
  position: { x: Math.round(node.position.x), y: Math.round(node.position.y) }
})))

const graphEdges = computed<StudioGraphEdge[]>(() => edges.value.map(edge => ({
  id: String(edge.id),
  source: edge.source,
  target: edge.target
})))

const validation = computed(() => validateGraph(graphNodes.value, graphEdges.value))

const validationMessage = computed(() => {
  return validation.value.reason ? t(`validation.${validation.value.reason}`) : t('validation.valid')
})

const badIdSet = computed(() => new Set(validation.value.badIds))

const pipelineItems = computed(() => pipelineList.value.map(pipeline => ({
  label: pipeline.name,
  value: pipeline.id
})))

const selectedPipeline = computed(() => {
  return pipelineList.value.find(pipeline => pipeline.id === pipelineId.value) ?? null
})

const paletteGroups = computed(() => NODE_CATEGORIES.map(group => ({
  ...group,
  defs: NODE_CATALOG.filter(def => def.category === group.id)
})))

const selectedNode = computed(() => {
  return nodes.value.find(node => node.id === selectedId.value) ?? null
})

const selectedDef = computed<StudioNodeDef>(() => {
  return nodeDefOf(String(selectedNode.value?.data?.kind ?? 'custom'))
})

const showPromptInput = computed(() => isPhaseKind(selectedDef.value.kind))

const showSchemaInput = computed(() => 'schema' in selectedDef.value.defaultConfig)

const showTemperatureInput = computed(() => {
  return String(selectedDef.value.phaseType ?? '').startsWith('llm')
})

const phaseCount = computed(() => graphNodes.value.filter(node => isPhaseKind(node.kind)).length)

const actionShortcuts = computed(() => {
  return graphNodes.value
    .filter(node => isActionKind(node.kind))
    .map(node => ({ id: node.id, kind: node.kind, label: t(nodeDefOf(node.kind).labelKey) }))
})

function makeStudioNode(def: StudioNodeDef, index: number, position?: { x: number, y: number }): FlowNode {
  nodeCounter += 1
  return {
    id: `n_${Date.now()}_${nodeCounter}`,
    type: 'studio',
    position: position ?? { x: 60 + (index % 5) * 220, y: 80 + Math.floor(index / 5) * 150 },
    data: {
      kind: def.kind,
      name: t(def.labelKey),
      prompt: def.defaultPrompt,
      config: { ...def.defaultConfig }
    }
  }
}

function toFlowNode(node: StudioGraphNode): FlowNode {
  return {
    id: node.id,
    type: 'studio',
    position: node.position,
    data: { kind: node.kind, name: node.name, prompt: node.prompt, config: node.config }
  }
}

function toFlowEdge(edge: StudioGraphEdge): FlowEdge {
  return { id: edge.id, source: edge.source, target: edge.target }
}

function chainEndId(): string | null {
  const order = linearize(graphNodes.value, graphEdges.value)
  const sources = new Set(graphEdges.value.map(edge => edge.source))
  const ends = order.filter(id => !sources.has(id))
  return ends[ends.length - 1] ?? null
}

function appendTargetFor(): string | null {
  if (selectedId.value) {
    return selectedId.value
  }
  return chainEndId()
}

function nodeDegree(id: string): number {
  return edges.value.filter(edge => edge.source === id || edge.target === id).length
}

function nodeRingClass(id: string): string {
  if (badIdSet.value.has(id)) {
    return 'ring-2 ring-error'
  }
  return selectedId.value === id ? 'ring-2 ring-primary' : 'ring-1 ring-muted'
}

function nodeDotClass(id: string): string {
  if (badIdSet.value.has(id)) {
    return 'bg-error'
  }
  return nodeDegree(id) === 0 && nodes.value.length > 1 ? 'bg-warning' : 'bg-success'
}

function collectSteps(): PipelineStep[] {
  return buildSteps(graphNodes.value, graphEdges.value, linearize(graphNodes.value, graphEdges.value))
}

function projectPosition(event: DragEvent): { x: number, y: number } {
  try {
    const rect = flowWrap.value?.getBoundingClientRect()
    const point = project({ x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) })
    return { x: Math.round(point.x), y: Math.round(point.y) }
  }
  catch {
    return { x: event.clientX % 400, y: event.clientY % 400 }
  }
}

function handleDragStart(event: DragEvent, kind: string) {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/x-studio-kind', kind)
    event.dataTransfer.effectAllowed = 'move'
  }
}

function handleCanvasDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  const kind = event.dataTransfer?.getData('application/x-studio-kind') ?? ''
  if (!kind) {
    return
  }
  const node = makeStudioNode(nodeDefOf(kind), nodes.value.length, projectPosition(event))
  nodes.value.push(node)
  selectedId.value = node.id
  toast.add({ title: t('toast.nodeAdded', { name: t(nodeDefOf(kind).labelKey) }), icon: 'i-heroicons-check-circle', color: 'success' })
}

function handleAddNode(kind: string) {
  const def = nodeDefOf(kind)
  const target = appendTargetFor()
  const node = makeStudioNode(def, nodes.value.length)
  nodes.value.push(node)
  if (target && !connectionError(target, String(node.id), graphNodes.value, graphEdges.value)) {
    edges.value.push({ id: `e_${target}_${node.id}`, source: target, target: String(node.id) })
  }
  selectedId.value = String(node.id)
  toast.add({ title: t('toast.nodeAdded', { name: t(def.labelKey) }), icon: 'i-heroicons-check-circle', color: 'success' })
}

function handleConnect(connection: Connection) {
  const problem = connectionError(connection.source, connection.target, graphNodes.value, graphEdges.value)
  if (problem) {
    toast.add({ title: t('toast.connectInvalid'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  edges.value.push({ id: `e_${connection.source}_${connection.target}`, source: connection.source, target: connection.target })
}

function handleNodeClick(payload: { node: { id: string } }) {
  selectedId.value = payload.node.id
}

function handlePaneClick() {
  selectedId.value = null
}

function handlePipelineSelect(id: string) {
  pipelineId.value = id
  void loadPipeline()
}

function ensureTrigger(list: StudioGraphNode[], links: StudioGraphEdge[]): { nodes: StudioGraphNode[], edges: StudioGraphEdge[] } {
  const hasTrigger = list.some(node => isTriggerKind(node.kind))
  if (hasTrigger) {
    return { nodes: list, edges: links }
  }
  const shifted = list.map((node, index) => ({ ...node, position: node.position ?? fallbackPosition(index + 1) }))
  const first = shifted[0]
  const trigger: StudioGraphNode = {
    id: `trigger_${Date.now()}`,
    kind: 'trigger-manual',
    name: t('nodes.triggerManual'),
    prompt: '',
    config: {},
    position: { x: (first?.position.x ?? 320) - 260, y: first?.position.y ?? 80 }
  }
  const nextEdges = first
    ? [...links, { id: `e_${trigger.id}_${first.id}`, source: trigger.id, target: first.id }]
    : links
  return { nodes: [trigger, ...shifted], edges: nextEdges }
}

async function loadPipeline() {
  if (!pipelineId.value) {
    return
  }
  loadingCanvas.value = true
  try {
    const pipeline = await getPipeline(pipelineId.value)
    const raw: unknown = pipeline?.steps ? JSON.parse(pipeline.steps) : []
    const graph = parseStepsToGraph(Array.isArray(raw) ? (raw as PipelineStep[]) : [])
    const ensured = ensureTrigger(graph.nodes, graph.edges)
    nodes.value = ensured.nodes.map(toFlowNode)
    edges.value = ensured.edges.map(toFlowEdge)
    selectedId.value = null
  }
  catch {
    toast.add({ title: t('toast.loadFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    loadingCanvas.value = false
  }
}

function collectGraph() {
  return {
    schemaVersion: 1,
    nodes: graphNodes.value.map(node => ({
      id: node.id,
      kind: node.kind,
      name: node.name,
      position: node.position,
      config: node.config,
    })),
    edges: graphEdges.value.map(edge => ({ id: edge.id, source: edge.source, target: edge.target })),
    policy: { requiresArtifactApproval: true, maxRetriesPerNode: 2, useBusinessContext: true },
  }
}

function readErrorMessage(err: unknown): string {
  const fetchError = err as { data?: { message?: string, statusMessage?: string }, message?: string }
  return fetchError.data?.message || fetchError.data?.statusMessage || fetchError.message || t('toast.saveFailed')
}

async function handleSave() {
  if (!pipelineId.value) {
    toast.add({ title: t('toast.selectRequired'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  if (!validation.value.ok) {
    toast.add({ title: validationMessage.value, icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  saving.value = true
  try {
    await updatePipeline(pipelineId.value, { steps: collectSteps() })
    await saveGraph(pipelineId.value, collectGraph())
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.saveFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function handleClone() {
  if (!pipelineId.value) {
    return
  }
  saving.value = true
  try {
    const copy = await clonePipeline(pipelineId.value)
    if (copy) {
      pipelineId.value = copy.id
      await loadPipeline()
    }
  }
  finally {
    saving.value = false
  }
}

async function handleActivate() {
  if (!pipelineId.value) {
    return
  }
  saving.value = true
  try {
    await activatePipeline(pipelineId.value)
  }
  finally {
    saving.value = false
  }
}

async function handleArchive() {
  if (!pipelineId.value) {
    return
  }
  saving.value = true
  try {
    await archivePipeline(pipelineId.value)
  }
  finally {
    saving.value = false
  }
}

async function handleRun() {
  if (!pipelineId.value) {
    toast.add({ title: t('toast.selectRequired'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  if (!validation.value.ok) {
    toast.add({ title: validationMessage.value, icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  running.value = true
  try {
    const run = await startRun(pipelineId.value, activeBusinessId.value, {
      brief: selectedPipeline.value?.name ?? '',
      useBusinessContext: true
    })
    if (run) {
      router.push(`/app/pipelines/runs/${run.id}`)
    }
  }
  finally {
    running.value = false
  }
}

function handleClear() {
  nodes.value = []
  edges.value = []
  selectedId.value = null
  toast.add({ title: t('toast.cleared'), icon: 'i-heroicons-check-circle', color: 'success' })
}

function handleFitView() {
  fitView()
}

function handleDeleteNode() {
  if (!selectedId.value) {
    return
  }
  const id = selectedId.value
  nodes.value = nodes.value.filter(node => node.id !== id)
  edges.value = edges.value.filter(edge => edge.source !== id && edge.target !== id)
  selectedId.value = null
  toast.add({ title: t('toast.nodeDeleted'), icon: 'i-heroicons-check-circle', color: 'success' })
}

async function handleCreatePipeline() {
  if (!newPipelineName.value.trim()) {
    toast.add({ title: t('toast.nameRequired'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  creating.value = true
  try {
    const created = await createPipeline({ businessId: activeBusinessId.value, name: newPipelineName.value.trim() })
    newPipelineName.value = ''
    if (created) {
      pipelineId.value = created.id
      await loadPipeline()
    }
  }
  finally {
    creating.value = false
  }
}

function handleShortcutAction(kind: string, label: string) {
  const href = selectedShortcutHref(kind)
  if (href) {
    toast.add({ title: t('actions.opened', { target: label }), icon: 'i-heroicons-check-circle', color: 'success' })
    router.push(href)
    return
  }
  toast.add({ title: t('actions.batchHint'), icon: 'i-heroicons-information-circle', color: 'neutral' })
}

function selectedShortcutHref(kind: string): string | null {
  const href = nodeDefOf(kind).defaultConfig.href
  return typeof href === 'string' ? href : null
}

function handleBack() {
  router.push('/app/pipelines')
}

onMounted(async () => {
  if (activeBusinessId.value) {
    await fetchPipelines(activeBusinessId.value)
    const preset = route.query.pipeline as string | undefined
    const known = preset ? pipelineList.value.some(pipeline => pipeline.id === preset) : false
    pipelineId.value = known && preset ? preset : (pipelineList.value[0]?.id ?? '')
    if (pipelineId.value) {
      await loadPipeline()
    }
  }
})
</script>

<template>
  <div class="mx-auto space-y-4">
    <BasePageHeader :title="t('title')" :description="t('description')">
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <UButton variant="ghost" color="neutral" icon="i-heroicons-arrow-left" @click="handleBack">
            {{ t('topbar.back') }}
          </UButton>
          <USelect
            :model-value="pipelineId"
            :items="pipelineItems"
            :placeholder="t('topbar.pipelinePlaceholder')"
            data-testid="studio-pipeline"
            class="min-w-52"
            @update:model-value="handlePipelineSelect"
          />
          <UButton color="primary" variant="solid" icon="i-heroicons-check" :loading="saving" data-testid="studio-save" @click="handleSave">
            {{ t('topbar.save') }}
          </UButton>
          <UButton color="primary" variant="outline" icon="i-heroicons-play" :loading="running" data-testid="studio-run" @click="handleRun">
            {{ t('topbar.run') }}
          </UButton>
          <UBadge v-if="selectedPipeline" color="neutral" variant="subtle" class="capitalize" data-testid="studio-status">
            {{ t(`workflow.${selectedPipeline.status ?? 'draft'}`) }} · v{{ selectedPipeline.version ?? 1 }}
          </UBadge>
          <UButton color="neutral" variant="ghost" icon="i-heroicons-square-2-stack" :loading="saving" data-testid="studio-clone" @click="handleClone">
            {{ t('topbar.clone') }}
          </UButton>
          <UButton
            v-if="selectedPipeline && selectedPipeline.status === 'draft'"
            color="neutral" variant="ghost" icon="i-heroicons-check-badge" :loading="saving" data-testid="studio-activate" @click="handleActivate"
          >
            {{ t('topbar.activate') }}
          </UButton>
          <UButton
            v-if="selectedPipeline && selectedPipeline.status !== 'archived'"
            color="neutral" variant="ghost" icon="i-heroicons-archive-box" :loading="saving" data-testid="studio-archive" @click="handleArchive"
          >
            {{ t('topbar.archive') }}
          </UButton>
        </div>
      </template>
    </BasePageHeader>

    <div v-motion-fade-visible :duration="200" class="flex flex-wrap items-center gap-2">
      <UInput v-model="newPipelineName" :placeholder="t('topbar.newPlaceholder')" data-testid="studio-new-name" class="min-w-52" />
      <UButton color="neutral" variant="outline" icon="i-heroicons-plus" :loading="creating" data-testid="studio-create" @click="handleCreatePipeline">
        {{ t('topbar.create') }}
      </UButton>
      <UButton color="neutral" variant="ghost" icon="i-heroicons-trash" data-testid="studio-clear" @click="handleClear">
        {{ t('topbar.clear') }}
      </UButton>
      <UButton color="neutral" variant="ghost" icon="i-heroicons-arrows-pointing-out" @click="handleFitView">
        {{ t('topbar.fit') }}
      </UButton>
      <span class="ml-auto text-xs text-muted">
        {{ t('canvas.phases', { count: phaseCount }) }} · {{ t('canvas.connections', { count: edges.length }) }}
      </span>
      <span data-testid="edge-count" class="hidden">{{ edges.length }}</span>
      <span data-testid="node-count" class="hidden">{{ nodes.length }}</span>
    </div>

    <div v-if="!validation.ok" v-motion-fade :duration="200" data-testid="studio-validation" class="rounded-xl border border-error/40 bg-error/10 px-4 py-2 text-sm text-error">
      {{ validationMessage }}
    </div>
    <div v-else v-motion-fade :duration="200" class="rounded-xl border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
      {{ validationMessage }}
    </div>

    <div class="grid gap-4 lg:grid-cols-[240px_1fr_300px]">
      <aside v-motion-fade-visible :duration="200" data-testid="studio-palette" class="space-y-4 rounded-2xl border border-muted bg-elevated/40 p-3">
        <div>
          <h2 class="font-semibold text-sm">{{ t('palette.title') }}</h2>
          <p class="text-xs text-muted">{{ t('palette.hint') }}</p>
        </div>
        <section v-for="group in paletteGroups" :key="group.id" class="space-y-2">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t(`palette.${group.id}`) }}</h3>
          <div
            v-for="def in group.defs"
            :key="def.kind"
            draggable="true"
            class="flex items-center gap-2 rounded-xl border border-muted bg-default p-2"
            @dragstart="handleDragStart($event, def.kind)"
          >
            <UIcon :name="def.icon" class="size-4 shrink-0 text-primary" />
            <span class="min-w-0 flex-1 truncate text-xs font-medium">{{ t(def.labelKey) }}</span>
            <UButton size="xs" variant="ghost" :data-testid="`palette-add-${def.kind}`" @click="handleAddNode(def.kind)">
              {{ t('palette.add') }}
            </UButton>
          </div>
        </section>
      </aside>

      <div
        ref="flowWrap"
        data-testid="studio-canvas"
        class="relative h-[62vh] min-h-96 overflow-hidden rounded-2xl border border-muted bg-default"
        @dragover="handleCanvasDragOver"
        @drop="handleDrop"
      >
        <div v-if="loadingCanvas" class="absolute inset-0 z-10 flex items-center justify-center bg-default/70">
          <UIcon name="i-heroicons-arrow-path" class="size-6 animate-spin" />
        </div>
        <div v-if="nodes.length === 0 && !loadingCanvas" class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-8 text-center">
          <p v-motion-fade :duration="200" class="max-w-sm text-sm text-muted">{{ t('canvas.empty') }}</p>
        </div>
        <ClientOnly>
          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            :fit-view-on-init="true"
            @connect="handleConnect"
            @node-click="handleNodeClick"
            @pane-click="handlePaneClick"
          >
            <Background />
            <Controls />
            <MiniMap />
            <template #node-studio="slotProps">
              <div
                data-testid="studio-node"
                :data-kind="String(slotProps.data?.kind ?? 'custom')"
                :class="nodeRingClass(String(slotProps.id))"
                class="flex min-w-40 items-center gap-2 rounded-xl border border-muted bg-elevated px-3 py-2 shadow-sm"
              >
                <Handle v-if="nodeDefOf(String(slotProps.data?.kind ?? 'custom')).hasInput" type="target" :position="Position.Left" />
                <UIcon :name="nodeDefOf(String(slotProps.data?.kind ?? 'custom')).icon" class="size-4 shrink-0 text-primary" />
                <span class="min-w-0 flex-1 truncate text-xs font-semibold">{{ String(slotProps.data?.name ?? slotProps.id) }}</span>
                <span class="size-2 shrink-0 rounded-full" :class="nodeDotClass(String(slotProps.id))" />
                <Handle v-if="nodeDefOf(String(slotProps.data?.kind ?? 'custom')).hasOutput" type="source" :position="Position.Right" />
              </div>
              <div class="mt-1 text-center">
                <UBadge size="xs" variant="subtle" color="neutral">{{ String(slotProps.data?.kind ?? 'custom') }}</UBadge>
              </div>
            </template>
          </VueFlow>
        </ClientOnly>
      </div>

      <aside v-motion-fade-visible :duration="200" class="rounded-2xl border border-muted bg-elevated/40 p-3">
        <h2 class="font-semibold text-sm">{{ t('inspector.title') }}</h2>
        <div v-if="selectedNode" v-motion-fade :duration="200" data-testid="node-inspector" class="mt-3 space-y-4">
          <div class="flex items-center gap-2 text-xs text-muted">
            <span>{{ t('inspector.kindLabel') }}</span>
            <UBadge size="xs" variant="subtle" color="neutral">{{ selectedDef.kind }}</UBadge>
            <span>{{ t('inspector.typeLabel') }}</span>
            <UBadge size="xs" variant="subtle" color="primary">{{ selectedDef.phaseType ?? '—' }}</UBadge>
          </div>
          <UFormField :label="t('inspector.name')" name="node-name">
            <UInput v-model="selectedNode.data.name" data-testid="node-name" class="w-full" />
          </UFormField>
          <UFormField v-if="showPromptInput" :label="t('inspector.prompt')" name="node-prompt">
            <UTextarea v-model="selectedNode.data.prompt" :placeholder="t('inspector.promptPlaceholder')" :rows="6" data-testid="node-prompt" class="w-full" />
          </UFormField>
          <UFormField v-if="showSchemaInput" :label="t('inspector.schema')" name="node-schema">
            <UInput v-model="selectedNode.data.config.schema" :placeholder="t('inspector.schemaPlaceholder')" class="w-full" />
          </UFormField>
          <UFormField v-if="showTemperatureInput" :label="t('inspector.temperature')" name="node-temperature">
            <UInput v-model.number="selectedNode.data.config.temperature" type="number" min="0" max="2" step="0.1" placeholder="0.7" class="w-full" />
          </UFormField>
          <UButton color="error" variant="outline" icon="i-heroicons-trash" data-testid="node-delete" @click="handleDeleteNode">
            {{ t('inspector.delete') }}
          </UButton>
        </div>
        <p v-else v-motion-fade :duration="200" class="mt-3 text-xs text-muted">{{ t('inspector.empty') }}</p>
      </aside>
    </div>

    <div v-if="actionShortcuts.length > 0" v-motion-slide-bottom :duration="250" class="rounded-2xl border border-muted bg-elevated/40 p-3">
      <h2 class="text-sm font-semibold">{{ t('shortcuts.title') }}</h2>
      <div class="mt-2 flex flex-wrap gap-2">
        <UButton
          v-for="item in actionShortcuts"
          :key="item.id"
          color="neutral"
          variant="outline"
          :icon="nodeDefOf(item.kind).icon"
          :data-testid="`shortcut-${item.kind}`"
          @click="handleShortcutAction(item.kind, item.label)"
        >
          {{ item.label }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.vue-flow__node-studio) {
  background: transparent;
}
</style>
