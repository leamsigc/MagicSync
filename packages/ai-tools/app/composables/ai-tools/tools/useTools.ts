import { ref } from 'vue'

export function useTextToSQL() {
  const query = ref('')
  const sql = ref('')
  const explanation = ref('')
  const tablesUsed = ref<string[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function generate(naturalQuery: string) {
    if (!naturalQuery.trim()) return

    query.value = naturalQuery
    isLoading.value = true
    error.value = null
    sql.value = ''
    explanation.value = ''
    tablesUsed.value = []

    try {
      const result = await $fetch<{
        query: string
        sql: string
        explanation: string
        tables_used: string[]
      }>('/api/ai-tools/tools/text-to-sql', {
        method: 'POST',
        body: { query: naturalQuery },
      })

      sql.value = result.sql
      explanation.value = result.explanation
      tablesUsed.value = result.tables_used
    } catch (e: any) {
      error.value = e?.data?.statusMessage || 'Failed to generate SQL'
    } finally {
      isLoading.value = false
    }
  }

  function clear() {
    query.value = ''
    sql.value = ''
    explanation.value = ''
    tablesUsed.value = []
    error.value = null
  }

  return { query, sql, explanation, tablesUsed, isLoading, error, generate, clear }
}

export function useWebSearch() {
  const results = ref<Array<{ title: string; url: string; snippet: string }>>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const lastQuery = ref('')

  async function search(query: string, maxResults = 5) {
    if (!query.trim()) return

    lastQuery.value = query
    isLoading.value = true
    error.value = null
    results.value = []

    try {
      const data = await $fetch<{
        query: string
        results: Array<{ title: string; url: string; snippet: string }>
        total_results: number
      }>('/api/ai-tools/tools/web-search', {
        method: 'POST',
        body: { query, max_results: maxResults },
      })

      results.value = data.results
    } catch (e: any) {
      error.value = e?.data?.statusMessage || 'Search failed'
    } finally {
      isLoading.value = false
    }
  }

  function clear() {
    results.value = []
    lastQuery.value = ''
    error.value = null
  }

  return { results, isLoading, error, lastQuery, search, clear }
}
