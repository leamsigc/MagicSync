import { ref, readonly } from 'vue'
import type { TemplateWithAssets, UpdateTemplateData } from './useTemplateManager'

/**
 * Single Template Composable for managing a single template state
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

export const useTemplate = (templateId?: string) => {
    const template = ref<TemplateWithAssets | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    const toast = useToast()

    /**
     * Fetch template by ID
     */
    const fetchTemplate = async (id?: string) => {
        const targetId = id || templateId
        if (!targetId) {
            error.value = 'Template ID is required'
            return
        }

        isLoading.value = true
        error.value = null

        try {
            const response = await $fetch<{ success: boolean; data: TemplateWithAssets }>(`/api/v1/templates/${targetId}`)

            if (response.success) {
                template.value = response.data
            }

            return response.data
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

    /**
     * Save template (update)
     */
    const saveTemplate = async (data: UpdateTemplateData, id?: string) => {
        const targetId = id || templateId || template.value?.id
        if (!targetId) {
            error.value = 'Template ID is required'
            return
        }

        isLoading.value = true
        error.value = null

        try {
            const response = await $fetch<{ success: boolean; data: TemplateWithAssets }>(`/api/v1/templates/${targetId}`, {
                method: 'PUT',
                body: data
            })

            if (response.success) {
                template.value = { ...template.value, ...response.data } as TemplateWithAssets

                toast.add({
                    title: 'Success',
                    description: 'Template saved successfully',
                    color: 'success'
                })
            }

            return response.data
        } catch (err: unknown) {
            const fetchError = err as { data?: { message?: string }; message?: string }
            const errorMessage = fetchError.data?.message || fetchError.message || 'Failed to save template'
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
     * Reset template state
     */
    const resetTemplate = () => {
        template.value = null
        error.value = null
    }

    return {
        // State
        template,
        isLoading: readonly(isLoading),
        error: readonly(error),

        // Methods
        fetchTemplate,
        saveTemplate,
        resetTemplate,

        // Utilities
        clearError: () => { error.value = null }
    }
}
