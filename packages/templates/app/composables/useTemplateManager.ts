import { ref, readonly } from 'vue'
import type { Template, TemplateAsset } from '#layers/BaseDB/db/schema'
import type { PaginatedResponse, PaginationOptions } from '#layers/BaseDB/server/services/types'
import { TemplateType } from '#layers/BaseDB/db/schema'

/**
 * Template Manager Composable for handling template CRUD operations
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

export type TemplateTypeValue = typeof TemplateType[number]

export type TemplateWithAssets = Template & {
    assets: TemplateAsset[]
}

export type CreateTemplateData = {
    type: TemplateTypeValue
    title: string
    content: string
    isPublic?: boolean
    assets?: Array<{ name: string; url: string }>
}

export type UpdateTemplateData = {
    title?: string
    content?: string
    isPublic?: boolean
}

export type TemplateFilters = {
    type?: TemplateTypeValue
    isPublic?: boolean
}

export const useTemplateManager = () => {
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const templateList = useState<Record<TemplateTypeValue, Template[]>>('templates:list', () => ({}))
    const pagination = useState<{ page: number; limit: number; total: number; totalPages: number } | null>('templates:pagination', () => null)

    const toast = useToast()

    /**
     * Get templates with pagination and filtering
     */
    const getTemplates = async (
        filters: TemplateFilters = {},
        paginationOptions: PaginationOptions = { page: 1, limit: 20 }
    ) => {
        isLoading.value = true
        error.value = null

        try {
            const query = new URLSearchParams({
                page: paginationOptions.page.toString(),
                limit: paginationOptions.limit.toString()
            })

            if (filters.type) {
                query.append('type', filters.type)
            }
            if (filters.isPublic !== undefined) {
                query.append('isPublic', filters.isPublic.toString())
            }

            const response = await $fetch<PaginatedResponse<Template>>(`/api/v1/templates?${query}`)

            templateList.value[filters.type] = response.data ?? []
            pagination.value = response.pagination ?? null

            return response
        } catch (err: unknown) {
            const fetchError = err as { data?: { message?: string }; message?: string }
            const errorMessage = fetchError.data?.message || fetchError.message || 'Failed to fetch templates'
            error.value = errorMessage
            toast.add({
                title: 'Error',
                description: errorMessage,
                color: 'error'
            })
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Get templates by type
     */
    const getTemplatesByType = async (
        type: TemplateTypeValue,
        paginationOptions: PaginationOptions = { page: 1, limit: 20 }
    ) => {
        return getTemplates({ type }, paginationOptions)
    }

    /**
     * Create a new template
     */
    const createTemplate = async (data: CreateTemplateData) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await $fetch<{ success: boolean; data: TemplateWithAssets }>('/api/v1/templates', {
                method: 'POST',
                body: data
            })

            if (response.success && response.data) {
                // Add to list
                templateList.value = [response.data, ...templateList.value]

                toast.add({
                    title: 'Success',
                    description: 'Template created successfully',
                    color: 'success'
                })
            }

            return response
        } catch (err: unknown) {
            const fetchError = err as { data?: { message?: string }; message?: string }
            const errorMessage = fetchError.data?.message || fetchError.message || 'Failed to create template'
            error.value = errorMessage
            toast.add({
                title: 'Error',
                description: errorMessage,
                color: 'error'
            })
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Update an existing template
     */
    const updateTemplate = async (id: string, data: UpdateTemplateData, type: TemplateTypeValue) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await $fetch<{ success: boolean; data: Template }>(`/api/v1/templates/${id}`, {
                method: 'PUT',
                body: data
            })

            if (response.success && response.data) {
                // Update in list
                const index = templateList.value[type].findIndex(t => t.id === id)
                if (index !== -1) {
                    templateList.value[type][index] = response.data
                }

                toast.add({
                    title: 'Success',
                    description: 'Template updated successfully',
                    color: 'success'
                })
            }

            return response
        } catch (err: unknown) {
            const fetchError = err as { data?: { message?: string }; message?: string }
            const errorMessage = fetchError.data?.message || fetchError.message || 'Failed to update template'
            error.value = errorMessage
            toast.add({
                title: 'Error',
                description: errorMessage,
                color: 'error'
            })
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Delete a template
     */
    const deleteTemplate = async (id: string) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await $fetch<{ success: boolean; message: string }>(`/api/v1/templates/${id}`, {
                method: 'DELETE'
            })

            if (response.success) {
                // Remove from list
                templateList.value = templateList.value.filter(t => t.id !== id)

                toast.add({
                    title: 'Success',
                    description: 'Template deleted successfully',
                    color: 'success'
                })
            }

            return response
        } catch (err: unknown) {
            const fetchError = err as { data?: { message?: string }; message?: string }
            const errorMessage = fetchError.data?.message || fetchError.message || 'Failed to delete template'
            error.value = errorMessage
            toast.add({
                title: 'Error',
                description: errorMessage,
                color: 'error'
            })
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Get a single template by ID
     */
    const getTemplateById = async (id: string) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await $fetch<{ success: boolean; data: TemplateWithAssets }>(`/api/v1/templates/${id}`)
            return response
        } catch (err: unknown) {
            const fetchError = err as { data?: { message?: string }; message?: string }
            const errorMessage = fetchError.data?.message || fetchError.message || 'Failed to fetch template'
            error.value = errorMessage
            toast.add({
                title: 'Error',
                description: errorMessage,
                color: 'error'
            })
            throw err
        } finally {
            isLoading.value = false
        }
    }

    return {
        // State
        isLoading: readonly(isLoading),
        error: readonly(error),
        templateList,
        pagination,

        // Methods
        getTemplates,
        getTemplatesByType,
        getTemplateById,
        createTemplate,
        updateTemplate,
        deleteTemplate,

        // Utilities
        clearError: () => { error.value = null },
        clearTemplates: () => { templateList.value = [] }
    }
}
