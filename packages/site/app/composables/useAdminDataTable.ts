import { useDebounceFn } from '@vueuse/core'
import type { AdminColumnMeta, AdminRow, AdminRowPage } from '#layers/BaseDB/server/services/admin-data.service'

export type AdminTableRow = AdminRow & { _key: string }

export interface AdminTableInfo {
  key: string
  label: string
  group: string
}

const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

interface FetchErrorLike {
  data?: { message?: string }
}

export function extractAdminErrorMessage(error: unknown): string {
  const message = (error as FetchErrorLike | undefined)?.data?.message
  if (message) return message
  return error instanceof Error ? error.message : ''
}

export function useAdminDataTable(tableKey: MaybeRefOrGetter<string>) {
  const key = computed(() => toValue(tableKey))

  const table = ref<AdminTableInfo | null>(null)
  const columns = ref<AdminColumnMeta[]>([])
  const rows = ref<AdminTableRow[]>([])
  const pagination = ref({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })
  const loading = ref(false)
  const loadError = ref(false)
  const searchInput = ref('')
  const filters = ref<Record<string, string>>({})
  const rowSelection = ref<Record<string, boolean>>({})

  const selectedKeys = computed(() => {
    const visibleKeys = new Set(rows.value.map(row => row._key))
    return Object.keys(rowSelection.value).filter(
      rowKey => rowSelection.value[rowKey] && visibleKeys.has(rowKey),
    )
  })
  const selectedCount = computed(() => selectedKeys.value.length)

  function buildQuery(): Record<string, string | number> {
    const query: Record<string, string | number> = {
      page: pagination.value.page,
      limit: pagination.value.limit,
    }
    const search = searchInput.value.trim()
    if (search) query.search = search
    for (const [column, value] of Object.entries(filters.value)) {
      if (value) query[`filter.${column}`] = value
    }
    return query
  }

  async function fetchRows() {
    loading.value = true
    loadError.value = false
    try {
      const data = await $fetch<AdminRowPage>(`/api/v1/admin/data/${key.value}`, {
        query: buildQuery(),
      })
      table.value = data.table
      columns.value = data.columns
      rows.value = data.rows as AdminTableRow[]
      pagination.value = data.pagination
    } catch {
      loadError.value = true
    } finally {
      loading.value = false
    }
  }

  function resetState() {
    table.value = null
    columns.value = []
    rows.value = []
    rowSelection.value = {}
    filters.value = {}
    searchInput.value = ''
    pagination.value = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 }
  }

  const applySearch = useDebounceFn(() => {
    pagination.value.page = 1
    fetchRows()
  }, SEARCH_DEBOUNCE_MS)

  watch(searchInput, () => applySearch())

  watch(
    key,
    () => {
      resetState()
      fetchRows()
    },
    { immediate: true },
  )

  function setFilter(column: string, value: string) {
    filters.value = { ...filters.value, [column]: value }
    pagination.value.page = 1
    fetchRows()
  }

  function setPage(page: number) {
    pagination.value.page = page
    fetchRows()
  }

  function getRowKey(row: AdminTableRow): string {
    return row._key
  }

  function clearSelection() {
    rowSelection.value = {}
  }

  function replaceRow(next: AdminTableRow) {
    const index = rows.value.findIndex(row => row._key === next._key)
    if (index === -1) return
    rows.value.splice(index, 1, next)
  }

  async function updateRow(
    rowKey: string,
    values: Record<string, string | number | boolean | null>,
  ): Promise<string | null> {
    const original = rows.value.find(row => row._key === rowKey)
    const previous = original ? { ...original } : undefined
    if (original) Object.assign(original, values)
    try {
      const data = await $fetch<{ row: AdminTableRow }>(`/api/v1/admin/data/${key.value}`, {
        method: 'PUT',
        body: { key: rowKey, values },
      })
      replaceRow(data.row)
      return null
    } catch (error) {
      if (previous) replaceRow(previous)
      return extractAdminErrorMessage(error)
    }
  }

  async function deleteRows(rowKeys: string[]): Promise<string | null> {
    const previous = [...rows.value]
    const previousTotal = pagination.value.total
    rows.value = rows.value.filter(row => !rowKeys.includes(row._key))
    pagination.value.total = Math.max(0, previousTotal - (previous.length - rows.value.length))
    clearSelection()
    try {
      await $fetch(`/api/v1/admin/data/${key.value}/bulk-delete`, {
        method: 'POST',
        body: { keys: rowKeys },
      })
      await reloadAfterDelete()
      return null
    } catch (error) {
      rows.value = previous
      pagination.value.total = previousTotal
      return extractAdminErrorMessage(error)
    }
  }

  async function reloadAfterDelete() {
    if (rows.value.length === 0 && pagination.value.page > 1) {
      pagination.value.page -= 1
      await fetchRows()
    }
  }

  return {
    table,
    columns,
    rows,
    pagination,
    loading,
    loadError,
    searchInput,
    filters,
    rowSelection,
    selectedKeys,
    selectedCount,
    fetchRows,
    setFilter,
    setPage,
    getRowKey,
    clearSelection,
    updateRow,
    deleteRows,
  }
}
