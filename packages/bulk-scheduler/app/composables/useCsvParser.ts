import Papa from 'papaparse'

export type CsvVariable = {
  name: string
  label: string
}

export type CsvParseResult = {
  variables: CsvVariable[]
  rows: Record<string, string>[]
}

export const useCsvParser = () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const parseCsv = (file: File): Promise<CsvParseResult> => {
    isLoading.value = true
    error.value = null

    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header, index) => {
          const trimmed = header.trim()
          if (!trimmed) return `column_${index + 1}`
          return trimmed.toLowerCase().replace(/\s+/g, '_')
        },
        complete: (results) => {
          isLoading.value = false
          if (results.errors.length > 0) {
            error.value = results.errors[0].message
            reject(new Error(results.errors[0].message))
            return
          }

          const variables: CsvVariable[] = (results.meta.fields || []).map(field => ({
            name: field,
            label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          }))

          const rows = results.data as Record<string, string>[]

          resolve({ variables, rows })
        },
        error: (err) => {
          isLoading.value = false
          error.value = err.message
          reject(err)
        }
      })
    })
  }

  return {
    parseCsv,
    isLoading,
    error
  }
}
