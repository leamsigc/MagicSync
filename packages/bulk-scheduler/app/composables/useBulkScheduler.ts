import type { PostCreateBase } from '#layers/BaseDB/db/schema'
import type { SystemVariable } from '../../utils/templateProcessor'
import type { CsvParseResult } from '../../utils/csvParser'

export type BulkSchedulerState = {
  isLoading: boolean
  error: string | null
  csvData: PostCreateBase[] | null
  generatedPosts: PostCreateBase[] | null
}

export const useBulkScheduler = () => {
  const { t } = useI18n()
  const toast = useToast()
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const csvData = ref<PostCreateBase[] | null>(null)
  const generatedPosts = ref<PostCreateBase[] | null>(null)

    const importFromCsv = async (
        file: File,
        platforms: string[],
        businessId: string,
        dateRange?: { startDate: Date; endDate: Date },
        distributeEvenly = false,
        selectedAssets: Asset[] = []
    ) => {
        isLoading.value = true
        error.value = null

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('platforms', JSON.stringify(platforms))
            formData.append('businessId', businessId)
            if (dateRange) {
                formData.append('startDate', dateRange.startDate.toISOString())
                formData.append('endDate', dateRange.endDate.toISOString())
            }
            formData.append('distributeEvenly', distributeEvenly.toString())
            formData.append('selectedAssets', JSON.stringify(selectedAssets.map(a => a.id)))

      const response = await $fetch<{
        success: boolean
        data: { created: number; failed: number; postIds: string[] }
      }>('/api/v1/bulk-scheduler/csv-import', {
        method: 'POST',
        body: formData
      })

      toast.add({
        title: t('toast.csvImportSuccess', { count: response.data.created }),
        icon: 'i-heroicons-check-circle',
        color: 'success'
      })

      return response
    } catch (err: unknown) {
      const errorData = err && typeof err === 'object' && 'data' in err ? (err as { data?: { errors?: string[]; message?: string } }).data : undefined
      const errorMessage = err instanceof Error ? err.message : 'Failed to import CSV'
      error.value = errorData?.message || errorMessage

      let description = ''
      if (errorData?.errors && errorData.errors.length > 0) {
        description = errorData.errors.slice(0, 3).join('; ') // Show first 3 errors
        if (errorData.errors.length > 3) {
          description += `; and ${errorData.errors.length - 3} more...`
        }
      } else {
        description = errorMessage
      }

      toast.add({
        title: t('toast.csvImportFailed'),
        description,
        icon: 'i-heroicons-x-circle',
        color: 'error'
      })
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const generateBulkPosts = async (request: {
    templateContent: string
    variables: string[]
    contentRows: Record<string, string>[]
    platforms: string[]
    businessId: string
    dateRange: { startDate: Date; endDate: Date }
    skipWeekends?: boolean
    businessHoursOnly?: boolean
    firstComment?: string
  }) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<{
        success: boolean
        data: { created: number; failed: number; postIds: string[] }
      }>('/api/v1/bulk-scheduler/generate', {
        method: 'POST',
        body: {
          ...request,
          startDate: request.dateRange.startDate.toISOString(),
          endDate: request.dateRange.endDate.toISOString()
        }
      })

      toast.add({
        title: t('toast.bulkGenerateSuccess', { count: response.data.created }),
        icon: 'i-heroicons-check-circle',
        color: 'success'
      })

      return response
    } catch (err: unknown) {
      const errorData = err && typeof err === 'object' && 'data' in err ? (err as { data?: { errors?: string[]; message?: string } }).data : undefined
      const errorMessage = err instanceof Error ? error.message : 'Failed to generate bulk posts'
      error.value = errorData?.message || errorMessage

      let description = ''
      if (errorData?.errors && errorData.errors.length > 0) {
        description = errorData.errors.slice(0, 3).join('; ') // Show first 3 errors
        if (errorData.errors.length > 3) {
          description += `; and ${errorData.errors.length - 3} more...`
        }
      } else {
        description = errorMessage
      }

      toast.add({
        title: t('toast.bulkGenerateFailed'),
        description,
        icon: 'i-heroicons-x-circle',
        color: 'error'
      })
      throw err
    }
  }

  const parseCsvPreview = async (file: File): Promise<CsvParseResult> => {
    const Papa = await import('papaparse')
    return new Promise((resolve) => {
      Papa.default.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve({
            success: true,
            data: results.data as PostCreateBase[]
          })
        },
        error: (error) => {
          resolve({
            success: false,
            errors: [error.message]
          })
        }
      })
    })
  }

  return {
    isLoading: readonly(isLoading),
    error: readonly(error),
    csvData,
    generatedPosts,
    importFromCsv,
    generateBulkPosts,
    parseCsvPreview,
    clearError: () => (error.value = null)
  }
}
