import { computed, reactive, ref } from 'vue'
import type { ImageEditorDocument } from '../../../../shared/image-editor/document'
import { renderDocumentRow, downloadDataUrl } from '../../../../shared/image-editor/client-render'

/**
 * Bulk design generation (client) — CSV / editable-table rows or cartesian
 * value arrays, posted to /api/v1/image-editor/batch, which returns stored
 * asset URLs or a ZIP download. Submitted values are never echoed back.
 */

export type BatchMode = 'rows' | 'values'

export interface BatchRow {
  [column: string]: string | number | boolean
}

export interface BatchResultItem {
  index: number
  assetId?: string
  url?: string
}

const PREVIEW_LIMIT = 6
const MAX_ROWS = 50

const state = reactive({
  mode: 'rows' as BatchMode,
  columns: [] as string[],
  rows: [] as BatchRow[],
  values: {} as Record<string, Array<string | number | boolean>>,
  running: false,
  progress: 0,
  requested: 0,
  results: [] as BatchResultItem[],
  failures: [] as Array<{ index: number; error: string }>,
  zipUrl: null as string | null,
  error: null as string | null,
  lastRunAt: null as string | null,
  /** Document used for client-only generation (anonymous visitors). */
  sourceDocument: null as ImageEditorDocument | null,
  sourceTitle: '',
  lastMode: null as 'server' | 'client' | null,
  downloaded: 0,
})

const fallbackZipUrl = ref<string | null>(null)

const rowsOut = computed(() => state.mode === 'rows' ? state.rows : cartesianRows(state.values))
const rowCount = computed(() => rowsOut.value.length)
const canRun = computed(() => rowCount.value > 0 && rowCount.value <= MAX_ROWS * 2)
const hasResults = computed(() => state.results.length > 0 || state.zipUrl !== null)

export function useDesignBatch() {
  const { t } = useI18n()
  /** TARGET from the editor panel; set before running. */
  const templateId = ref('')

  function setMode(mode: BatchMode): void {
    state.mode = mode
  }

  function setTemplate(id: string): void {
    templateId.value = id
  }

  /** Provide a document for client-side generation (imported JSON / current design). */
  function setSourceDocument(document: ImageEditorDocument, title = ''): void {
    state.sourceDocument = document
    state.sourceTitle = title
    templateId.value = ''
    state.lastMode = 'client'
  }

  function clearSourceDocument(): void {
    state.sourceDocument = null
    state.sourceTitle = ''
  }

  function reset(): void {
    state.columns = []
    state.rows = []
    state.values = {}
    state.results = []
    state.failures = []
    state.zipUrl = null
    state.error = null
    state.requested = 0
    state.progress = 0
    state.downloaded = 0
    state.sourceDocument = null
    state.sourceTitle = ''
    state.lastMode = null
    fallbackZipUrl.value = null
  }

  async function importCsv(file: File): Promise<number> {
    const Papa = await import('papaparse')
    const text = await file.text()
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.trim(),
    })
    const rows = parsed.data.filter(row => Object.values(row).some(value => String(value ?? '').length > 0))
    if (rows.length === 0) {
      state.error = t('studio.bulk.csvEmpty')
      return 0
    }
    const columns = rows.reduce<string[]>((acc, row) => {
      for (const key of Object.keys(row)) if (!acc.includes(key)) acc.push(key)
      return acc
    }, [])
    state.mode = 'rows'
    state.columns = columns.slice(0, 16)
    state.rows = rows.slice(0, MAX_ROWS)
    state.error = null
    return state.rows.length
  }

  function addRow(): void {
    if (state.rows.length >= MAX_ROWS) return
    state.rows.push(Object.fromEntries(state.columns.map(column => [column, ''])))
  }

  function addColumn(name = `field_${state.columns.length + 1}`): boolean {
    const trimmed = name.trim()
    if (!trimmed || state.columns.includes(trimmed)) return false
    state.columns.push(trimmed)
    state.rows = state.rows.map(row => ({ ...row, [trimmed]: '' }))
    return true
  }

  /** Rename a column and move every row value to the new key. */
  function renameColumn(previous: string, next: string): boolean {
    const trimmed = next.trim()
    if (!trimmed || trimmed === previous) return false
    if (state.columns.includes(trimmed)) return false
    state.columns = state.columns.map(column => (column === previous ? trimmed : column))
    state.rows = state.rows.map((row) => {
      if (!(previous in row)) return row
      const { [previous]: value, ...rest } = row
      return { ...rest, [trimmed]: value }
    })
    return true
  }

  function removeColumn(name: string): void {
    state.columns = state.columns.filter(column => column !== name)
    state.rows = state.rows.map((row) => {
      const { [name]: _removed, ...rest } = row
      return rest
    })
  }

  /** Rename a value-array column (cartesian mode). */
  function renameValueColumn(previous: string, next: string): boolean {
    const trimmed = next.trim()
    if (!trimmed || trimmed === previous || trimmed in state.values) return false
    const entries = Object.entries(state.values).map(([name, list]) => [name === previous ? trimmed : name, list] as const)
    state.values = Object.fromEntries(entries)
    return true
  }

  function removeRow(index: number): void {
    state.rows = state.rows.toSpliced(index, 1)
  }

  function setValueColumn(name: string, values: string[]): void {
    state.values = { ...state.values, [name]: values.filter(value => value !== '') }
  }

  /* ------------------------------------------------------------ request */

  /** Convert one row to the render contract: `fields__` keys → flat; plain → dynamic_fields. */
  function splitRow(row: BatchRow): {
    dynamic_fields: Array<Record<string, string | number | boolean>>
    dynamic_fields_flat: Record<string, string | number | boolean>
  } {
    const dynamic_fields: Array<Record<string, string | number | boolean>> = []
    const dynamic_fields_flat: Record<string, string | number | boolean> = {}
    for (const [key, value] of Object.entries(row)) {
      const stringValue = String(value ?? '')
      if (stringValue === '') continue
      if (key.startsWith('fields__')) {
        dynamic_fields_flat[key] = value
      } else if (looksLikeUrl(stringValue)) {
        dynamic_fields.push({ name: key, image_url: stringValue })
      } else {
        dynamic_fields.push({ name: key, text: stringValue })
      }
    }
    return { dynamic_fields, dynamic_fields_flat }
  }

  function stripEmptyRow(row: BatchRow): BatchRow {
    return Object.fromEntries(Object.entries(row).filter(entry => String(entry[1] ?? '') !== ''))
  }

  function requestBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      templateId: templateId.value,
      output: 'zip',
      format: 'png',
    }
    if (state.mode === 'rows') {
      body.rows = state.rows.map(stripEmptyRow)
    } else {
      body.values = state.values
    }
    return body
  }

  async function run(): Promise<void> {
    if (!canRun.value) return
    if (!templateId.value && state.sourceDocument) {
      await runClient()
      return
    }
    if (!templateId.value) return
    state.running = true
    state.progress = 0
    state.error = null
    state.results = []
    state.failures = []
    state.zipUrl = null
    try {
      const response = await $fetch<{
        count: number
        requested: number
        renders: BatchResultItem[]
        failures: Array<{ index: number; error: string }>
        zipUrl?: string
        importWarnings?: string[]
      }>('/api/v1/image-editor/batch', { method: 'POST', body: requestBody() })
      state.requested = response.requested
      state.results = response.renders ?? []
      state.failures = response.failures ?? []
      state.zipUrl = response.zipUrl ?? null
      state.progress = 100
      state.lastMode = 'server'
      if (!response.zipUrl && (response.renders?.length ?? 0) > 0) {
        buildFallbackZip(response.renders ?? [])
      }
      state.lastRunAt = new Date().toISOString()
    } catch (error) {
      state.error = error instanceof Error ? error.message : t('studio.bulk.requestFailed')
    }
    state.running = false
  }

  /**
   * Anonymous generation — render each row in the browser and download one
   * file per row. No document or values leave the device.
   */
  async function runClient(): Promise<void> {
    const doc = state.sourceDocument
    if (!doc) return
    const rows = rowsOut.value
    if (rows.length === 0) return

    state.running = true
    state.requested = rows.length
    state.results = []
    state.failures = []
    state.error = null
    state.downloaded = 0
    state.progress = 0
    state.lastMode = 'client'

    for (const [index, row] of rows.entries()) {
      try {
        const url = await renderDocumentRow(doc, { row })
        state.results.push({ index, url })
        downloadDataUrl(url, `render-${String(index + 1).padStart(4, '0')}.png`)
        state.downloaded += 1
        // Small gap so browsers keep every download rather than collapsing them.
        await new Promise(resolve => setTimeout(resolve, 150))
      } catch (error) {
        state.failures.push({ index, error: error instanceof Error ? error.message : 'Render failed' })
      }
      state.progress = Math.round(((index + 1) / rows.length) * 100)
    }

    state.lastRunAt = new Date().toISOString()
    state.running = false
  }

  /** Per-row image previews (bounded at 6 to respect render rate limits). */
  async function preview(): Promise<Array<{ index: number; url: string }>> {
    const rows = rowsOut.value.slice(0, PREVIEW_LIMIT)
    if (rows.length === 0) return []
    if (!templateId.value) {
      if (!state.sourceDocument) return []
      const previews: Array<{ index: number; url: string }> = []
      for (const [index, row] of rows.entries()) {
        try {
          previews.push({ index, url: await renderDocumentRow(state.sourceDocument, { row, format: 'jpeg', scale: 0.35 }) })
        } catch {
          // skip rows that fail to preview
        }
      }
      return previews
    }
    const previews: Array<{ index: number; url: string }> = []
    for (const [index, row] of rows.entries()) {
      try {
        const parts = splitRow(row)
        const blob = await $fetch<Blob>('/api/v1/image-editor/render', {
          method: 'POST',
          body: {
            templateId: templateId.value,
            format: 'jpeg',
            scale: 0.35,
            ...parts,
          },
          responseType: 'blob',
        })
        previews.push({ index, url: URL.createObjectURL(blob) })
      } catch {
        // preview rows that fail are just skipped from the grid
      }
    }
    return previews
  }

  function downloadZip(): void {
    const url = state.zipUrl ?? fallbackZipUrl.value
    if (!url || typeof document === 'undefined') return
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.rel = 'noopener'
    anchor.download = 'design-batch.zip'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  /** When the batch returns asset-only (older contract), zip client-side via fflate. */
  async function buildFallbackZip(results: BatchResultItem[]): Promise<void> {
    try {
      const { zipSync } = await import('fflate')
      const entries: Record<string, Uint8Array> = {}
      const files = await Promise.all(results.slice(0, MAX_ROWS).map(async (result) => {
        if (!result.url) return { name: '', bytes: new Uint8Array() }
        const response = await fetch(result.url)
        const bytes = new Uint8Array(await response.arrayBuffer())
        return { name: `render-${String(result.index).padStart(4, '0')}.png`, bytes }
      }))
      for (const file of files) if (file.name) entries[file.name] = file.bytes
      const zipped = zipSync(entries, { level: 3 })
      fallbackZipUrl.value = URL.createObjectURL(new Blob([zipped as BlobPart], { type: 'application/zip' }))
    } catch {
      fallbackZipUrl.value = null
    }
  }

  return {
    state, rowsOut, rowCount, canRun, hasResults,
    templateId, setTemplate, setSourceDocument, clearSourceDocument, setMode, reset,
    importCsv, addRow, addColumn, renameColumn, renameValueColumn, removeColumn, removeRow, setValueColumn,
    splitRow, run, preview, downloadZip, fallbackZipUrl,
    PREVIEW_LIMIT, MAX_ROWS,
  }
}

function looksLikeUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/api/v1/image-editor/assets/')
}

/** Client-side cartesian expansion, mirrored from the shared resolve-rows. */
function cartesianRows(values: Record<string, Array<string | number | boolean>>): BatchRow[] {
  let combos: BatchRow[] = [{}]
  for (const [name, list] of Object.entries(values)) {
    if (!Array.isArray(list) || list.length === 0) continue
    const next: BatchRow[] = []
    for (const combo of combos) for (const value of list) next.push({ ...combo, [name]: value })
    combos = next
  }
  return combos
}
