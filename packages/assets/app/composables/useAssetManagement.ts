/**
 * Asset Management Operations Composable
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the composable
 * @todo [ ] Integration test
 * @todo [✔] Update the typescript
 */

import type { Asset } from "#layers/BaseDB/db/schema"


export interface AssetFilters {
  mimeType?: string
  search?: string
}

export interface AssetPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface AssetListResponse {
  data: Asset[]
  pagination: AssetPagination
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface FileUploadItem {
  file: File
  id: string
  progress: UploadProgress
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
  asset?: Asset
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data: { message?: string } }).data
    if (data?.message) return data.message
  }
  return fallback
}

const assets = ref<Asset[]>([])
export const useAssetManagement = () => {
  const selectedAssets = ref<Asset[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref<AssetPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const filters = ref<AssetFilters>({})
  const uploadQueue = ref<FileUploadItem[]>([])

  const { getAssetType, formatFileSize } = useAsset()

  const clearError = () => {
    error.value = null
  }
  const fetUserAssets = async () => {
    try {
      const response = await $fetch<{ data: Asset[] }>('/api/v1/assets?own=true')
      assets.value = response.data
    } catch (error: unknown) {
      error.value = getErrorMessage(error, 'Failed to fetch assets')
    }
  }

  const fetchAssets = async (businessId: string, options?: {
    page?: number
    limit?: number
    filters?: AssetFilters
  }): Promise<void> => {
    isLoading.value = true
    error.value = null

    try {
      const params = new URLSearchParams({
        businessId,
        page: (options?.page || pagination.value.page).toString(),
        limit: (options?.limit || pagination.value.limit).toString()
      })

      if (options?.filters?.mimeType) {
        params.append('mimeType', options.filters.mimeType)
      }

      const response = await $fetch<{
        success: boolean
        data: Asset[]
        pagination: AssetPagination
        error?: string
      }>(`/api/v1/assets?${params.toString()}`)

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch assets')
      }

      assets.value = response.data
      pagination.value = response.pagination

      if (options?.filters) {
        filters.value = options.filters
      }
    } catch (error: unknown) {
      error.value = getErrorMessage(error, 'Failed to fetch assets')
      assets.value = []
    } finally {
      isLoading.value = false
    }
  }

  const uploadFiles = async (files: File[], businessId?: string): Promise<boolean> => {
    // Add files to upload queue
    const uploadItems: FileUploadItem[] = files.map(file => ({
      file,
      id: crypto.randomUUID(),
      progress: { loaded: 0, total: file.size, percentage: 0 },
      status: 'pending'
    }))

    uploadQueue.value.push(...uploadItems)

    try {
      // Update status to uploading
      uploadItems.forEach(item => {
        item.status = 'uploading'
        item.progress.percentage = 50 // Show progress
      })

      // Convert files to nuxt-file-storage format
      const serverFiles = await Promise.all(
        files.map(async (file) => {
          return new Promise<{ name: string; type: string; size: number; content: string }>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => {
              resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                content: reader.result as string
              })
            }
            reader.readAsDataURL(file)
          })
        })
      )

      const response = await $fetch<{
        success: boolean
        data: Asset[]
        message?: string
        error?: string
      }>('/api/v1/assets', {
        method: 'POST',
        body: {
          files: serverFiles
        }
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to upload files')
      }

      // Update upload items with results
      response.data.forEach((asset, index) => {
        if (uploadItems[index]) {
          uploadItems[index].status = 'completed'
          uploadItems[index].progress.percentage = 100
          uploadItems[index].asset = asset
        }
      })

      // Add new assets to the list
      assets.value.unshift(...response.data)

      // Remove completed uploads from queue after a delay
      setTimeout(() => {
        uploadQueue.value = uploadQueue.value.filter(item =>
          !uploadItems.some(uploadItem => uploadItem.id === item.id)
        )
      }, 3000)
      return true
    } catch (err: any) {
      // Mark all uploads as failed
      uploadItems.forEach(item => {
        item.status = 'error'
        item.error = err.data?.message || err.message || 'Upload failed'
      })

      error.value = err.data?.message || err.message || 'Failed to upload files'
      return false
    }
  }

  const uploadFromUrl = async (url: string, businessId: string, filename?: string): Promise<Asset | null> => {
    isLoading.value = true
    error.value = null

    try {
      // Extract filename from URL if not provided
      const urlFilename = filename || url.split('/').pop() || 'downloaded-asset'

      const response = await $fetch<{
        success: boolean
        data: Asset
        error?: string
      }>('/api/v1/assets', {
        method: 'POST',
        body: {
          businessId,
          url,
          filename: urlFilename,
          originalName: urlFilename,
          mimeType: 'application/octet-stream', // Will be detected server-side
          size: 0 // Will be detected server-side
        }
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to upload from URL')
      }

      // Add to assets list
      assets.value.unshift(response.data)

      return response.data
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to upload from URL'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const deleteAssets = async (assetIds: string[]): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      await Promise.all(
        assetIds.map(id =>
          $fetch(`/api/v1/assets/${id}`, { method: 'DELETE' })
        )
      )

      // Remove deleted assets from the list
      assets.value = assets.value.filter(asset => !assetIds.includes(asset.id))

      // Remove from selected assets
      selectedAssets.value = selectedAssets.value.filter(asset => !assetIds.includes(asset.id))

      return true
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to delete assets'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const selectAsset = (asset: Asset): void => {
    const index = selectedAssets.value.findIndex(a => a.id === asset.id)
    if (index === -1) {
      selectedAssets.value.push(asset)
    }
  }

  const deselectAsset = (asset: Asset): void => {
    const index = selectedAssets.value.findIndex(a => a.id === asset.id)
    if (index !== -1) {
      selectedAssets.value.splice(index, 1)
    }
  }

  const toggleAssetSelection = (asset: Asset): void => {
    const isSelected = selectedAssets.value.some(a => a.id === asset.id)
    if (isSelected) {
      deselectAsset(asset)
    } else {
      selectAsset(asset)
    }
  }

  const selectAllAssets = (): void => {
    selectedAssets.value = [...assets.value]
  }

  const deselectAllAssets = (): void => {
    selectedAssets.value = []
  }

  const isAssetSelected = (asset: Asset): boolean => {
    return selectedAssets.value.some(a => a.id === asset.id)
  }

  const getAssetsByType = (type: 'image' | 'video' | 'document' | 'other'): Asset[] => {
    return assets.value.filter(asset => getAssetType(asset.mimeType) === type)
  }

  const getStorageUsage = (): { totalSize: number; formattedSize: string; count: number } => {
    const totalSize = assets.value.reduce((sum, asset) => sum + asset.size, 0)
    return {
      totalSize,
      formattedSize: formatFileSize(totalSize),
      count: assets.value.length
    }
  }

  const searchAssets = (query: string): Asset[] => {
    if (!query.trim()) return assets.value

    const lowercaseQuery = query.toLowerCase()
    return assets.value.filter(asset =>
      asset.originalName.toLowerCase().includes(lowercaseQuery) ||
      asset.filename.toLowerCase().includes(lowercaseQuery)
    )
  }

  const filterAssetsByMimeType = (mimeType: string): Asset[] => {
    return assets.value.filter(asset => asset.mimeType.startsWith(mimeType))
  }

  const refreshAssets = async (businessId: string): Promise<void> => {
    await fetchAssets(businessId, {
      page: pagination.value.page,
      limit: pagination.value.limit,
      filters: filters.value
    })
  }

  const loadMoreAssets = async (businessId: string): Promise<void> => {
    if (pagination.value.page >= pagination.value.totalPages) return

    const nextPage = pagination.value.page + 1

    try {
      const params = new URLSearchParams({
        businessId,
        page: nextPage.toString(),
        limit: pagination.value.limit.toString()
      })

      if (filters.value.mimeType) {
        params.append('mimeType', filters.value.mimeType)
      }

      const response = await $fetch<{
        success: boolean
        data: Asset[]
        pagination: AssetPagination
        error?: string
      }>(`/api/v1/assets?${params.toString()}`)

      if (response.success) {
        assets.value.push(...response.data)
        pagination.value = response.pagination
      }
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to load more assets'
    }
  }

  return {
    // State
    assets: readonly(assets),
    selectedAssets: readonly(selectedAssets),
    isLoading: readonly(isLoading),
    error: readonly(error),
    pagination: readonly(pagination),
    filters: readonly(filters),
    uploadQueue: readonly(uploadQueue),

    // Actions
    fetchAssets,
    clearError,
    uploadFiles,
    uploadFromUrl,
    deleteAssets,
    refreshAssets,
    loadMoreAssets,

    // Selection
    selectAsset,
    deselectAsset,
    toggleAssetSelection,
    selectAllAssets,
    deselectAllAssets,
    isAssetSelected,

    // Utilities
    getAssetsByType,
    getStorageUsage,
    searchAssets,
    filterAssetsByMimeType,
    fetUserAssets
  }
}
