<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs'
import { useDesignStudio } from '../../../composables/tools/image-editor/useDesignStudio'
import { useDesignBatch, type BatchRow } from '../../../composables/tools/image-editor/useDesignBatch'
import { normalizeDocument } from '../../../../shared/image-editor/normalize'
import { deriveTextFields } from '../../../../shared/image-editor/fields'
import type { ImageEditorDocument } from '../../../../shared/image-editor/document'

/**
 * Bulk generate — rows-first batch (CSV import or editable table) or
 * cartesian value arrays, rendered server-side via /api/v1/image-editor/batch.
 * Output = stored assets + ZIP download. Values are never echoed.
 */

const { t } = useI18n()
const { editor } = useFabricJs()
const studio = useDesignStudio()
const batch = useDesignBatch()
const state = batch.state

const open = defineModel<boolean>('open', { default: false })
const tab = ref<'rows' | 'values' | 'preview'>('rows')
const previews = ref<Array<{ index: number; url: string }>>([])
const previewsBusy = ref(false)

const csvInput = ref<HTMLInputElement>()
const templateInput = ref<HTMLInputElement>()
const templateFields = ref<string[]>([])
const addColumnOpen = ref(false)
const newColumnName = ref('')
const addValueColumnOpen = ref(false)
const newValueColumnName = ref('')

/** Load the selected design's variables so columns can be named to match. */
async function loadTemplateFields(id: string): Promise<void> {
  if (!id) {
    templateFields.value = []
    return
  }
  try {
    const design = await $fetch<{ document?: ImageEditorDocument | null }>(`/api/v1/image-editor/designs/${id}`)
    const document = design.document
    if (!document || !Array.isArray(document.fields) || !Array.isArray(document.pages)) {
      templateFields.value = []
      return
    }
    const resolved = document.fields.length > 0 ? document : deriveTextFields(document)
    templateFields.value = resolved.fields.map(field => field.name)
  } catch {
    templateFields.value = []
  }
}

function isTemplateField(column: string): boolean {
  if (column.startsWith('fields__') || templateFields.value.length === 0) return true
  return templateFields.value.includes(column)
}

/** Anonymous flow: use the document currently open in the editor. */
function useCurrentDocument(): void {
  const plugin = editor.value?.getPlugin?.('studio') as { currentDocument?: () => ImageEditorDocument } | undefined
  const doc = plugin?.currentDocument?.()
  if (!doc) {
    useToast().add({ title: t('studio.bulk.noDocument'), color: 'warning', icon: 'i-lucide-alert-triangle' })
    return
  }
  batch.setSourceDocument(doc, studio.currentTitle.value)
  templateFields.value = doc.fields.map(field => field.name)
  useToast().add({ title: t('studio.bulk.templateLoaded'), description: studio.currentTitle.value, color: 'success', icon: 'i-lucide-file-json' })
}

function pickTemplateJson(): void {
  templateInput.value?.click()
}

/** Anonymous flow: import a document JSON for client-side rendering. */
async function importTemplateJson(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as Record<string, unknown>
    const source = parsed.schema === 'magicsync/image-editor@1' && parsed.doc ? parsed.doc : parsed
    const { document: doc, warnings } = normalizeDocument({ json: source })
    batch.setSourceDocument(doc, file.name)
    templateFields.value = doc.fields.map(field => field.name)
    useToast().add({
      title: t('studio.bulk.templateLoaded'),
      description: warnings.length > 0 ? t('studio.bulk.templateWarnings', { count: warnings.length }) : file.name,
      color: 'success',
      icon: 'i-lucide-file-json',
    })
  } catch {
    useToast().add({ title: t('studio.bulk.templateInvalid'), color: 'error', icon: 'i-lucide-x-circle' })
  }
  if (templateInput.value) templateInput.value.value = ''
}

function addColumnNamed(name: string): void {
  const value = name.trim()
  if (!value) return
  if (!batch.addColumn(value)) {
    useToast().add({ title: t('studio.bulk.duplicateColumn'), description: value, color: 'warning', icon: 'i-lucide-columns-3' })
    return
  }
  newColumnName.value = ''
  addColumnOpen.value = false
}

/** UInput's change event carries the DOM Event; update:modelValue carries the value. */
function eventValue(value: unknown): string {
  if (value instanceof Event) return (value.target as HTMLInputElement | null)?.value ?? ''
  return String(value ?? '')
}

function commitColumnRename(previous: string, value: unknown): void {
  const next = eventValue(value).trim()
  if (!next || next === previous) return
  if (!batch.renameColumn(previous, next)) {
    useToast().add({ title: t('studio.bulk.duplicateColumn'), description: next, color: 'warning', icon: 'i-lucide-columns-3' })
  }
}

function addValueColumnNamed(name: string): void {
  const value = name.trim()
  if (!value) return
  if (value in state.values) {
    useToast().add({ title: t('studio.bulk.duplicateColumn'), description: value, color: 'warning', icon: 'i-lucide-shuffle' })
    return
  }
  batch.setValueColumn(value, [])
  newValueColumnName.value = ''
  addValueColumnOpen.value = false
}

function commitValueColumnRename(previous: string, value: unknown): void {
  const next = eventValue(value).trim()
  if (!next || next === previous) return
  if (!batch.renameValueColumn(previous, next)) {
    useToast().add({ title: t('studio.bulk.duplicateColumn'), description: next, color: 'warning', icon: 'i-lucide-shuffle' })
  }
}

function designOptionLabel(design: { title: string; updatedAt?: string }): string {
  if (!design.updatedAt) return design.title
  const date = new Date(design.updatedAt)
  const label = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return label ? `${design.title} · ${label}` : design.title
}

const unmatchedColumns = computed(() => {
  if (templateFields.value.length === 0) return state.columns
  return state.columns.filter(column => !column.startsWith('fields__') && !templateFields.value.includes(column))
})

const sourceLabel = computed(() => {
  const match = studio.designs.value.find(design => design.id === batch.templateId.value)
  return match?.title ?? studio.currentTitle.value
})
const canGenerate = computed(() => (!!batch.templateId.value || !!batch.state.sourceDocument) && batch.canRun.value)

function closeModal(): void {
  open.value = false
}

function selectModeTab(mode: 'rows' | 'values'): void {
  tab.value = mode
  batch.setMode(mode)
}

async function handleOpen(next: boolean): Promise<void> {
  if (!next) return
  if (studio.currentId.value) batch.setTemplate(studio.currentId.value)
  await studio.fetchDesigns('', 0)
  if (!batch.templateId.value && studio.designs.value.length > 0) {
    const first = studio.designs.value[0]
    if (first) batch.setTemplate(first.id)
  }
  await loadTemplateFields(batch.templateId.value)
}

function chooseDesign(id: string): void {
  batch.setTemplate(id)
  void loadTemplateFields(id)
  const match = studio.designs.value.find(design => design.id === id)
  if (match) studio.setTitle(match.title)
}

function selectedDesign(): string | null {
  return batch.templateId.value
}

async function pickCsv(): Promise<void> {
  csvInput.value?.click()
}

async function importCsv(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const count = await batch.importCsv(file)
  if (count > 0) {
    tab.value = 'rows'
    useToast().add({ title: t('studio.bulk.csvLoaded', { count }), color: 'success', icon: 'i-lucide-file-spreadsheet' })
  } else if (state.error) {
    useToast().add({ title: state.error, color: 'error', icon: 'i-lucide-x-circle' })
  }
  if (csvInput.value) csvInput.value.value = ''
}

function cellValue(row: BatchRow, column: string): string {
  return String(row[column] ?? '')
}

function setCell(row: BatchRow, column: string, value: string): void {
  const index = state.rows.indexOf(row)
  if (index < 0) return
  state.rows[index] = { ...row, [column]: value }
}

const valueColumns = computed(() => Object.keys(state.values))
const previewLimitLabel = computed(() => t('studio.bulk.previewLimit', { count: batch.PREVIEW_LIMIT }))

async function loadPreviews(): Promise<void> {
  previewsBusy.value = true
  previews.value = await batch.preview()
  previewsBusy.value = false
  tab.value = 'preview'
}

async function generate(): Promise<void> {
  await batch.run()
  if (state.error) {
    useToast().add({ title: state.error, color: 'error', icon: 'i-lucide-x-circle' })
    return
  }
  if ((state.results?.length ?? 0) > 0) {
    useToast().add({
      title: t('studio.bulk.done', { ok: state.results.length, total: state.requested }),
      color: state.failures.length > 0 ? 'warning' : 'success',
      icon: 'i-lucide-check',
    })
  }
}

function setValuesFor(name: string, raw: string): void {
  batch.setValueColumn(name, raw.split('|').map(entry => entry.trim()))
}

function valuesAsText(name: string): string {
  return (state.values[name] ?? []).join(' | ')
}

function resetAll(): void {
  batch.reset()
  previews.value = []
}

watch(open, (value) => {
  if (value) void handleOpen(true)
})

onMounted(() => {
  if (studio.currentId.value) {
    batch.setTemplate(studio.currentId.value)
    void loadTemplateFields(studio.currentId.value)
  }
})
</script>

<template>
  <UModal v-model:open="open" :ui="{ content: 'max-w-5xl' }">
    <template #content>
      <div class="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <header class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">{{ t('studio.bulk.title') }}</h2>
            <p class="text-xs text-muted">{{ t('studio.bulk.subtitle') }}</p>
          </div>
          <UButton size="xs" variant="ghost" icon="lucide:x" :aria-label="t('common.close')" @click="closeModal" />
        </header>

        <!-- source -->
        <section class="rounded-xl border border-default bg-elevated/50 p-3 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-medium">{{ t('studio.bulk.source') }}</div>
            <span v-if="selectedDesign()" class="text-[11px] text-muted truncate max-w-60">{{ sourceLabel }}</span>
          </div>
          <template v-if="studio.requiresAuth.value">
            <UAlert
              color="neutral" variant="soft" icon="i-lucide-laptop"
              :title="t('studio.bulk.clientTitle')" :description="t('studio.bulk.clientDesc')" />
            <div class="flex flex-wrap gap-2">
              <UButton size="xs" variant="soft" icon="lucide:file-json" @click="useCurrentDocument">
                {{ t('studio.bulk.useCurrentDesign') }}
              </UButton>
              <UButton size="xs" variant="outline" icon="lucide:upload" @click="pickTemplateJson">
                {{ t('studio.bulk.importTemplate') }}
              </UButton>
              <input ref="templateInput" data-testid="bulk-template-input" type="file" accept=".json,application/json" class="hidden" @change="importTemplateJson">
            </div>
            <div v-if="batch.state.sourceDocument" class="flex items-center gap-1 text-[11px] text-success">
              <Icon name="lucide:check" class="w-3.5 h-3.5" />
              {{ batch.state.sourceTitle || t('studio.bulk.templateLoaded') }}
            </div>
            <div class="text-[11px] text-muted">{{ t('studio.bulk.serverLoginHint') }}</div>
          </template>
          <template v-else>
            <USelect
              :model-value="batch.templateId.value"
              :items="studio.designs.value.map(d => ({ label: designOptionLabel(d), value: d.id }))"
              size="xs"
              :placeholder="t('studio.bulk.chooseSource')"
              @update:model-value="value => chooseDesign(String(value ?? ''))" />
            <div v-if="!batch.templateId.value" class="flex items-center gap-1 text-[11px] text-warning">
              <Icon name="lucide:info" class="w-3.5 h-3.5" />
              {{ t('studio.bulk.saveFirst') }}
            </div>
          </template>
        </section>

        <!-- mode tabs -->
        <div class="flex gap-1.5">
          <UButton
            v-for="modeTab in (['rows', 'values'] as const)" :key="modeTab"
            size="xs" :variant="tab === modeTab ? 'soft' : 'ghost'"
            :color="tab === modeTab ? 'primary' : 'neutral'"
            @click="selectModeTab(modeTab)">
            {{ modeTab === 'rows' ? t('studio.bulk.rowsTab') : t('studio.bulk.valuesTab') }}
          </UButton>
          <UButton
            size="xs" :variant="tab === 'preview' ? 'soft' : 'ghost'"
            :color="tab === 'preview' ? 'primary' : 'neutral'"
            @click="loadPreviews">
            {{ t('studio.bulk.previewTab') }}
          </UButton>
        </div>

        <!-- ROWS TAB -->
        <section v-if="tab === 'rows'" class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <UButton size="xs" variant="outline" icon="lucide:file-spreadsheet" @click="pickCsv">
              {{ t('studio.bulk.importCsv') }}
            </UButton>
            <input ref="csvInput" data-testid="bulk-csv-input" type="file" accept=".csv,text/csv" class="hidden" @change="importCsv">
            <UButton size="xs" variant="outline" icon="lucide:plus" @click="batch.addRow()">
              {{ t('studio.bulk.addRow') }}
            </UButton>
            <UPopover v-model:open="addColumnOpen">
              <UButton size="xs" variant="outline" icon="lucide:columns-3">
                {{ t('studio.bulk.addColumn') }}
              </UButton>
              <template #content>
                <div class="w-64 space-y-2 p-3">
                  <div class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">{{ t('studio.bulk.pickVariable') }}</div>
                  <div v-if="templateFields.length > 0" class="flex flex-wrap gap-1">
                    <UButton
                      v-for="field in templateFields" :key="field"
                      size="xs" variant="soft" color="neutral" class="font-mono"
                      @click="addColumnNamed(field)">
                      {{ field }}
                    </UButton>
                  </div>
                  <div v-else class="text-[11px] text-muted">{{ t('studio.bulk.noVariables') }}</div>
                  <UInput
                    v-model="newColumnName" size="xs" class="font-mono"
                    :placeholder="t('studio.bulk.customColumn')"
                    @keydown.enter="addColumnNamed(newColumnName)" />
                  <UButton block size="xs" color="primary" icon="lucide:plus" @click="addColumnNamed(newColumnName)">
                    {{ t('studio.bulk.createColumn') }}
                  </UButton>
                  <div class="text-[10px] text-muted">{{ t('studio.bulk.renameHint') }}</div>
                </div>
              </template>
            </UPopover>
            <UButton size="xs" variant="ghost" color="error" icon="lucide:rotate-ccw" @click="resetAll">
              {{ t('common.reset') }}
            </UButton>
          </div>

          <div class="text-[11px] text-muted">{{ t('studio.bulk.csvHint') }}</div>

          <UAlert
            v-if="templateFields.length === 0"
            color="warning" variant="soft" icon="i-lucide-braces"
            :title="t('studio.bulk.noVariablesTitle')" :description="t('studio.bulk.noVariablesDesc')" />
          <UAlert
            v-else-if="unmatchedColumns.length > 0"
            color="warning" variant="soft" icon="i-lucide-unlink"
            :title="t('studio.bulk.columnsMismatch', { columns: unmatchedColumns.join(', '), fields: templateFields.join(', ') })" />

          <div v-if="state.columns.length > 0" class="overflow-x-auto border border-default rounded-xl max-h-80">
            <table class="w-full text-xs">
              <thead class="bg-muted/60 sticky top-0">
                <tr>
                  <th class="px-2 py-1.5 text-left text-[10px] text-muted w-10">#</th>
                  <th v-for="column in state.columns" :key="column" class="px-2 py-1.5 text-left text-[10px] font-mono">
                    <div class="flex items-center gap-1">
                      <UInput
                        :model-value="column" size="xs" variant="ghost"
                        class="min-w-24 font-mono"
                        :aria-label="t('studio.bulk.columnName')"
                        @change="value => commitColumnRename(column, value)" />
                      <UTooltip v-if="!isTemplateField(column)" :text="t('studio.bulk.columnMismatch')">
                        <Icon name="lucide:alert-triangle" class="size-3.5 shrink-0 text-warning" />
                      </UTooltip>
                      <UButton size="xs" variant="ghost" icon="lucide:x" :aria-label="t('studio.bulk.removeColumn')" @click="batch.removeColumn(column)" />
                    </div>
                  </th>
                  <th class="w-8" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in state.rows" :key="index" class="border-t border-default">
                  <td class="px-2 py-1 text-[10px] text-muted">{{ index + 1 }}</td>
                  <td v-for="column in state.columns" :key="column" class="px-1 py-0.5">
                    <UInput
                      :model-value="cellValue(row, column)" size="xs" variant="ghost" class="min-w-32"
                      @update:model-value="value => setCell(row, column, String(value ?? ''))" />
                  </td>
                  <td class="px-1">
                    <UButton size="xs" variant="ghost" color="error" icon="lucide:trash-2" :aria-label="t('studio.bulk.removeRow')" @click="batch.removeRow(index)" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <UAlert v-else color="neutral" variant="soft" icon="i-lucide-file-spreadsheet"
            :title="t('studio.bulk.noRows.title')" :description="t('studio.bulk.noRows.desc')" />
        </section>

        <!-- VALUES TAB -->
        <section v-else-if="tab === 'values'" class="space-y-3">
          <div class="flex gap-2">
            <UPopover v-model:open="addValueColumnOpen">
              <UButton size="xs" variant="outline" icon="lucide:plus">
                {{ t('studio.bulk.addValueColumn') }}
              </UButton>
              <template #content>
                <div class="w-64 space-y-2 p-3">
                  <div class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">{{ t('studio.bulk.pickVariable') }}</div>
                  <div v-if="templateFields.length > 0" class="flex flex-wrap gap-1">
                    <UButton
                      v-for="field in templateFields" :key="field"
                      size="xs" variant="soft" color="neutral" class="font-mono"
                      @click="addValueColumnNamed(field)">
                      {{ field }}
                    </UButton>
                  </div>
                  <div v-else class="text-[11px] text-muted">{{ t('studio.bulk.noVariables') }}</div>
                  <UInput
                    v-model="newValueColumnName" size="xs" class="font-mono"
                    :placeholder="t('studio.bulk.customColumn')"
                    @keydown.enter="addValueColumnNamed(newValueColumnName)" />
                  <UButton block size="xs" color="primary" icon="lucide:plus" @click="addValueColumnNamed(newValueColumnName)">
                    {{ t('studio.bulk.createColumn') }}
                  </UButton>
                </div>
              </template>
            </UPopover>
            <UButton size="xs" variant="ghost" color="error" icon="lucide:rotate-ccw" @click="resetAll">
              {{ t('common.reset') }}
            </UButton>
          </div>
          <div class="text-[11px] text-muted">{{ t('studio.bulk.valuesHint') }}</div>
          <div v-for="column in valueColumns" :key="column" class="rounded-xl border border-default bg-elevated/50 p-3 space-y-2">
            <div class="flex items-center gap-1">
              <UInput
                :model-value="column" size="xs" variant="ghost" class="min-w-28 font-mono"
                :aria-label="t('studio.bulk.columnName')"
                @change="value => commitValueColumnRename(column, value)" />
              <UTooltip v-if="!isTemplateField(column)" :text="t('studio.bulk.columnMismatch')">
                <Icon name="lucide:alert-triangle" class="size-3.5 text-warning" />
              </UTooltip>
            </div>
            <UInput
              :model-value="valuesAsText(column)" size="xs"
              :placeholder="t('studio.bulk.valuesPlaceholder')"
              @update:model-value="value => setValuesFor(column, String(value ?? ''))" />
            <div class="text-[10px] text-muted">{{ t('studio.bulk.valueCount', { count: (state.values[column] ?? []).length }) }}</div>
          </div>
          <UAlert v-if="valueColumns.length === 0" color="neutral" variant="soft" icon="i-lucide-shuffle"
            :title="t('studio.bulk.noValues.title')" :description="t('studio.bulk.noValues.desc')" />
        </section>

        <!-- PREVIEW TAB -->
        <section v-else class="space-y-3">
          <div class="flex items-center gap-2">
            <UButton size="xs" variant="outline" icon="lucide:refresh-ccw" :loading="previewsBusy" @click="loadPreviews">
              {{ t('studio.bulk.refreshPreviews') }}
            </UButton>
            <span class="text-[11px] text-muted">{{ previewLimitLabel }}</span>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div v-for="preview in previews" :key="preview.index" class="space-y-1">
              <div class="flex h-52 items-center justify-center overflow-hidden rounded-lg border border-default bg-muted">
                <img :src="preview.url" :alt="`preview ${preview.index + 1}`" class="max-h-full max-w-full object-contain">
              </div>
              <div class="text-[10px] text-muted text-center">#{{ preview.index + 1 }}</div>
            </div>
          </div>
          <UAlert v-if="!previewsBusy && previews.length === 0" color="neutral" variant="soft" icon="i-lucide-images"
            :title="t('studio.bulk.noPreviews')" />
        </section>

        <!-- RESULTS -->
        <section v-if="state.zipUrl || batch.fallbackZipUrl.value || state.results.length > 0" class="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold">{{ t('studio.bulk.results', { ok: state.results.length, total: state.requested }) }}</span>
            <UButton
              v-if="state.lastMode !== 'client'"
              size="xs" color="primary" variant="soft" icon="lucide:download" @click="batch.downloadZip()">
              {{ t('studio.bulk.downloadZip') }}
            </UButton>
            <span v-else class="text-[11px] text-success">
              {{ t('studio.bulk.downloadedRows', { count: state.downloaded }) }}
            </span>
          </div>
          <div v-if="state.failures.length > 0" class="text-[11px] text-warning">
            {{ t('studio.bulk.failures', { count: state.failures.length }) }}
          </div>
          <div class="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            <img
              v-for="result in state.results.slice(0, 9)" :key="result.index"
              :src="result.url" :alt="`render ${result.index + 1}`"
              class="w-full rounded-lg border border-default" loading="lazy">
          </div>
        </section>

        <!-- footer actions -->
        <footer class="flex items-center justify-between gap-3 border-t border-default pt-3">
          <div class="text-[11px] text-muted">
            {{ t('studio.bulk.rowCount', { count: batch.rowCount.value }) }}
          </div>
          <div class="flex gap-2">
            <UButton size="sm" variant="ghost" @click="closeModal">{{ t('common.close') }}</UButton>
            <UButton
              size="sm" color="primary" icon="lucide:layers"
              :loading="state.running" :disabled="!canGenerate"
              @click="generate">
              {{ t('studio.bulk.generate') }}
            </UButton>
          </div>
        </footer>
      </div>
    </template>
  </UModal>
</template>
