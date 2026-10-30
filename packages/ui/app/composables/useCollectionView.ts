/**
 * Collection view state: view mode + search + filters + sort, with one filtered
 * list every view reads from.
 *
 * The page keeps ownership of its data (a ref/computed of rows) and passes the
 * predicates; this composable only holds UI state. The selected view is
 * persisted per `key` in localStorage and restored on mount, so switching
 * between pages keeps the user's preferred layout.
 */
import { computed, onMounted, ref, watch, type Ref } from 'vue'

export type CollectionViewMode = string

export interface CollectionViewOptions<Row> {
  /** Stable storage key, e.g. `admin-users`. */
  key: string
  modes: CollectionViewMode[]
  defaultView?: CollectionViewMode
  rows: Ref<Row[]> | (() => Row[])
  /** Values searched (case-insensitive) when the user types. */
  searchFields?: (row: Row) => Array<string | number | null | undefined>
  /** One predicate per filter key; `__all__` or `''` means "no filter". */
  filterFns?: Record<string, (row: Row, value: string) => boolean>
  sorters?: Record<string, (a: Row, b: Row) => number>
  initialFilters?: Record<string, string>
  initialSort?: string
}

/** Sentinel for "no filter". Pages may also pass `__all__`. */
const ALL = 'all'

function isAll(value: string | undefined): boolean {
  return !value || value === ALL || value === '__all__'
}

function storageKey(key: string): string {
  return `collection-view:${key}`
}

export function useCollectionView<Row>(options: CollectionViewOptions<Row>) {
  const modes = options.modes.length > 0 ? options.modes : ['table']
  const defaultView = options.defaultView && modes.includes(options.defaultView)
    ? options.defaultView
    : modes[0]!
  const initialFilters: Record<string, string> = {}
  for (const key of Object.keys(options.filterFns || {})) {
    initialFilters[key] = options.initialFilters?.[key] ?? ALL
  }

  const view = ref<CollectionViewMode>(defaultView)
  const search = ref('')
  const filters = ref<Record<string, string>>(initialFilters)
  const sort = ref<string>(options.initialSort ?? '')

  const rowsRef = typeof options.rows === 'function' ? computed(options.rows) : options.rows

  const filtered = computed<Row[]>(() => {
    const term = search.value.trim().toLowerCase()
    const activeFilters = Object.entries(filters.value).filter(([, value]) => !isAll(value))
    const source = rowsRef.value || []
    const matched = source.filter(row => matchesSearch(row, term) && matchesFilters(row, activeFilters))
    const sorter = options.sorters?.[sort.value]
    return sorter ? [...matched].sort(sorter) : matched
  })

  const total = computed(() => (rowsRef.value || []).length)
  const hasActiveFilters = computed(() =>
    search.value.trim().length > 0
    || Object.values(filters.value).some(value => !isAll(value)),
  )

  function matchesSearch(row: Row, term: string): boolean {
    if (!term) return true
    const fields = options.searchFields?.(row) || []
    return fields.some(value => String(value ?? '').toLowerCase().includes(term))
  }

  function matchesFilters(row: Row, activeFilters: Array<[string, string]>): boolean {
    return activeFilters.every(([key, value]) => {
      const predicate = options.filterFns?.[key]
      return predicate ? predicate(row, value) : true
    })
  }

  function setView(next: CollectionViewMode) {
    if (modes.includes(next)) view.value = next
  }

  function setSearch(next: string) {
    search.value = next
  }

  function setFilter(key: string, value: string) {
    filters.value = { ...filters.value, [key]: value }
  }

  function setSort(next: string) {
    sort.value = next
  }

  function resetFilters() {
    search.value = ''
    for (const key of Object.keys(filters.value)) filters.value[key] = ALL
    filters.value = { ...filters.value }
  }

  onMounted(() => {
    try {
      const stored = window.localStorage.getItem(storageKey(options.key))
      if (stored && modes.includes(stored)) view.value = stored
    } catch {
      // Private mode / storage disabled — keep the default view.
    }
  })

  watch(view, (next) => {
    try {
      window.localStorage.setItem(storageKey(options.key), next)
    } catch {
      // Storage is best-effort.
    }
  })

  return {
    view,
    setView,
    search,
    setSearch,
    filters,
    setFilter,
    resetFilters,
    sort,
    setSort,
    filtered,
    total,
    hasActiveFilters,
    isAll,
    modes,
  }
}
