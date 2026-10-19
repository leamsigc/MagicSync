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
import { folderScopeToken, type AssetFolderSummary, type FolderScope } from '#layers/BaseShared/shared/utils/asset-folders'

export type { AssetFolderSummary, FolderScope } from '#layers/BaseShared/shared/utils/asset-folders'

export interface AssetFilters {
  mimeType?: string
  search?: string
  /** Undefined means "no folder predicate" — every asset, filed or not. */
  folderScope?: FolderScope
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

export type AssetDeletionStatus = 'pending' | 'deleting' | 'deleted' | 'error'

export interface AssetDeletionItem {
  id: string
  name: string
  size: number
  status: AssetDeletionStatus
  error?: string
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data: { message?: string } }).data
    if (data?.message) return data.message
  }
  return fallback
}

function appendFolderScope(params: URLSearchParams, scope: FolderScope | undefined) {
  const token = scope ? folderScopeToken(scope) : undefined
  if (token) params.append('folderId', token)
}

function resolveDeletionItem(id: string): AssetDeletionItem {
  const asset = assets.value.find(item => item.id === id) ?? selectedAssets.value.find(item => item.id === id)
  return {
    id,
    name: asset?.originalName || asset?.filename || id,
    size: asset?.size ?? 0,
    status: 'pending',
  }
}

async function requestAssetDeletion(item: AssetDeletionItem): Promise<void> {
  item.status = 'deleting'
  try {
    await $fetch(`/api/v1/assets/${item.id}`, { method: 'DELETE' })
    item.status = 'deleted'
  } catch (caught: unknown) {
    item.status = 'error'
    item.error = getErrorMessage(caught, 'Failed to delete asset')
  }
}

const assets = ref<Asset[]>([])
const assetFolders = ref<AssetFolderSummary[]>([])
const folderScope = ref<FolderScope>({ kind: 'unfiled' })
// Module-level on purpose, like `assets`. `MediaGallery` owns the selection UI but the
// page component runs the move and delete, so a per-instance ref left the executor
// reading an empty selection and posting `assetIds: []`.
const selectedAssets = ref<Asset[]>([])
const deletionItems = ref<AssetDeletionItem[]>([])
const isDeletingAssets = ref(false)

export const useAssetManagement = () => {
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
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
    } catch (caught: unknown) {
      error.value = getErrorMessage(caught, 'Failed to fetch assets')
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

      appendFolderScope(params, options?.filters?.folderScope)

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
    } catch (caught: unknown) {
      error.value = getErrorMessage(caught, 'Failed to fetch assets')
      assets.value = []
    } finally {
      isLoading.value = false
    }
  }

  const uploadFiles = async (files: File[], businessId?: string): Promise<Asset[]> => {
    const uploadItems: FileUploadItem[] = files.map(file => ({
      file,
      id: crypto.randomUUID(),
      progress: { loaded: 0, total: file.size, percentage: 0 },
      status: 'pending'
    }))

    uploadQueue.value.push(...uploadItems)

    const uploadedAssets: Asset[] = []
    const CHUNK_THRESHOLD = 20 * 1024 * 1024
    const CHUNK_SIZE = 8 * 1024 * 1024

    const setQueue = (item: FileUploadItem, mutator: (q: FileUploadItem) => void) => {
      const q = uploadQueue.value.find(qq => qq.id === item.id)
      if (q) mutator(q)
    }

    for (const file of files) {
      const item = uploadItems.find(i => i.file === file)!
      const queueItem = uploadQueue.value.find(q => q.id === item.id)!
      queueItem.status = 'uploading'
      queueItem.progress.total = file.size

      try {
        let asset: Asset | null = null

        if (file.size > CHUNK_THRESHOLD) {
          // Chunked upload to bypass per-request size limits (e.g. Cloudflare 100MB)
          const uploadId = crypto.randomUUID()
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1
          for (let i = 0; i < totalChunks; i++) {
            const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
            const fd = new FormData()
            fd.append('uploadId', uploadId)
            fd.append('chunkIndex', String(i))
            fd.append('totalChunks', String(totalChunks))
            fd.append('fileName', file.name)
            fd.append('mimeType', file.type || 'application/octet-stream')
            fd.append('fileSize', String(file.size))
            if (businessId) fd.append('businessId', businessId)
            fd.append('chunk', chunk, `chunk-${i}`)

            const response = await $fetch<{ success: boolean; data: Asset[] | null; error?: string }>(
              '/api/v1/assets/chunk',
              { method: 'POST', body: fd }
            )
            if (!response.success) throw new Error(response.error || 'Chunk upload failed')

            queueItem.progress.loaded = Math.min(file.size, (i + 1) * CHUNK_SIZE)
            queueItem.progress.percentage = Math.round(((i + 1) / totalChunks) * 100)

            if (response.data) {
              asset = Array.isArray(response.data) ? response.data[0] : response.data
            }
          }
        } else {
          // Single multipart upload with real XHR progress
          const fd = new FormData()
          fd.append('files', file)
          if (businessId) fd.append('businessId', businessId)

          const response = await new Promise<{ success: boolean; data: Asset[]; error?: string }>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open('POST', '/api/v1/assets')
            xhr.setRequestHeader('Accept', 'application/json')

            xhr.upload.onprogress = (event) => {
              if (!event.lengthComputable) return
              queueItem.progress.loaded = event.loaded
              queueItem.progress.total = event.total
              queueItem.progress.percentage = Math.round((event.loaded / event.total) * 100)
            }

            xhr.onload = () => {
              try {
                const parsed = JSON.parse(xhr.responseText)
                if (xhr.status >= 200 && xhr.status < 300) resolve(parsed)
                else reject(new Error(parsed?.error || parsed?.message || `Upload failed (${xhr.status})`))
              } catch {
                if (xhr.status === 413) reject(new Error('File is too large for the upload limit.'))
                else reject(new Error(`Upload failed (${xhr.status || 'unknown'})`))
              }
            }
            xhr.onerror = () => reject(new Error('Network error during upload'))
            xhr.onabort = () => reject(new Error('Upload aborted'))
            xhr.send(fd)
          })

          if (!response.success) throw new Error(response.error || 'Upload failed')
          asset = (Array.isArray(response.data) ? response.data[0] : response.data) as Asset
        }

        if (asset) {
          queueItem.status = 'completed'
          queueItem.progress.percentage = 100
          queueItem.asset = asset
          uploadedAssets.push(asset)

          const existingIds = new Set(assets.value.map(a => a.id))
          if (!existingIds.has(asset.id)) {
            assets.value.unshift(asset)
            existingIds.add(asset.id)
          }
        } else {
          throw new Error('Upload failed')
        }
      } catch (err: any) {
        queueItem.status = 'error'
        queueItem.error = err?.data?.message || err?.message || 'Upload failed'
        error.value = queueItem.error || null
      }
    }

    // Remove completed uploads from queue after a delay
    setTimeout(() => {
      uploadQueue.value = uploadQueue.value.filter(item =>
        !uploadItems.some(uploadItem => uploadItem.id === item.id)
      )
    }, 3000)

    return uploadedAssets
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

      const asset = Array.isArray(response.data) ? response.data[0] : response.data

      // Add to assets list
      if (asset) {
        assets.value.unshift(asset)
      }

      return asset ?? null
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to upload from URL'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const deleteAssets = async (assetIds: string[]): Promise<boolean> => {
    if (isDeletingAssets.value || assetIds.length === 0) return false

    isDeletingAssets.value = true
    error.value = null
    deletionItems.value = assetIds.map(resolveDeletionItem)

    await Promise.all(deletionItems.value.map(requestAssetDeletion))

    const deletedIds = new Set(
      deletionItems.value.filter(item => item.status === 'deleted').map(item => item.id),
    )
    assets.value = assets.value.filter(asset => !deletedIds.has(asset.id))
    selectedAssets.value = selectedAssets.value.filter(asset => !deletedIds.has(asset.id))

    isDeletingAssets.value = false
    return deletedIds.size === assetIds.length
  }

  const clearDeletionHistory = (): void => {
    deletionItems.value = []
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
      page: 1,
      limit: pagination.value.limit,
      filters: { ...filters.value, folderScope: folderScope.value },
    })
  }

  const fetchFolders = async (businessId: string): Promise<void> => {
    try {
      const response = await $fetch<{ success: boolean; data: AssetFolderSummary[]; error?: string }>(
        '/api/v1/assets/folders',
        { query: { businessId } },
      )
      if (!response.success) throw new Error(response.error || 'Failed to fetch asset folders')
      assetFolders.value = response.data
    } catch (caught: unknown) {
      error.value = getErrorMessage(caught, 'Failed to fetch asset folders')
    }
  }

  const createFolder = async (businessId: string, name: string): Promise<AssetFolderSummary | null> => {
    isLoading.value = true
    error.value = null
    try {
      const response = await $fetch<{ success: boolean; data: AssetFolderSummary; error?: string }>(
        '/api/v1/assets/folders',
        { method: 'POST', body: { businessId, name } },
      )
      if (!response.success) throw new Error(response.error || 'Failed to create asset folder')
      assetFolders.value = [response.data, ...assetFolders.value]
      return response.data
    } catch (caught: unknown) {
      error.value = getErrorMessage(caught, 'Failed to create asset folder')
      return null
    } finally {
      isLoading.value = false
    }
  }

  const deleteFolder = async (folderId: string, businessId: string): Promise<number | null> => {
    isLoading.value = true
    error.value = null
    try {
      const response = await $fetch<{ success: boolean; data: { id: string; unfiledCount: number }; error?: string }>(
        `/api/v1/assets/folders/${folderId}`,
        { method: 'DELETE', query: { businessId } },
      )
      if (!response.success) throw new Error(response.error || 'Failed to delete asset folder')
      assetFolders.value = assetFolders.value.filter(folder => folder.id !== folderId)
      return response.data.unfiledCount
    } catch (caught: unknown) {
      error.value = getErrorMessage(caught, 'Failed to delete asset folder')
      return null
    } finally {
      isLoading.value = false
    }
  }

  /** `folderId: null` is a first-class move back to the unfiled bucket, not a delete. */
  const moveAssets = async (
    businessId: string,
    assetIds: string[],
    folderId: string | null,
  ): Promise<{ moved: number; rejected: string[] } | null> => {
    isLoading.value = true
    error.value = null
    try {
      const response = await $fetch<{ success: boolean; data: { moved: number; rejected: string[] }; error?: string }>(
        '/api/v1/assets/move',
        { method: 'POST', body: { businessId, assetIds, folderId } },
      )
      if (!response.success) throw new Error(response.error || 'Failed to move assets')
      const movedIds = new Set(response.data.moved ? assetIds.filter(id => !response.data.rejected.includes(id)) : [])
      assets.value = assets.value.map(asset =>
        movedIds.has(asset.id) ? { ...asset, folderId } : asset,
      )
      await fetchFolders(businessId)
      return response.data
    } catch (caught: unknown) {
      error.value = getErrorMessage(caught, 'Failed to move assets')
      return null
    } finally {
      isLoading.value = false
    }
  }

  const setFolderScope = (scope: FolderScope) => {
    folderScope.value = scope
  }

  const loadMoreAssets = async (businessId: string): Promise<void> => {
    if (isLoadingMore.value) return
    if (pagination.value.page >= pagination.value.totalPages) return

    const nextPage = pagination.value.page + 1
    isLoadingMore.value = true

    try {
      const params = new URLSearchParams({
        businessId,
        page: nextPage.toString(),
        limit: pagination.value.limit.toString()
      })

      if (filters.value.mimeType) {
        params.append('mimeType', filters.value.mimeType)
      }

      appendFolderScope(params, folderScope.value)

      const response = await $fetch<{
        success: boolean
        data: Asset[]
        pagination: AssetPagination
        error?: string
      }>(`/api/v1/assets?${params.toString()}`)

      if (response.success) {
        const existingIds = new Set(assets.value.map(a => a.id))
        response.data.forEach(asset => {
          if (!existingIds.has(asset.id)) {
            assets.value.push(asset)
            existingIds.add(asset.id)
          }
        })
        pagination.value = response.pagination
      }
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to load more assets'
    } finally {
      isLoadingMore.value = false
    }
  }

  return {
    // State
    assets: readonly(assets),
    selectedAssets: readonly(selectedAssets),
    isLoading: readonly(isLoading),
    isLoadingMore: readonly(isLoadingMore),
    error: readonly(error),
    pagination: readonly(pagination),
    filters: readonly(filters),
    uploadQueue: readonly(uploadQueue),
    assetFolders: readonly(assetFolders),
    folderScope: readonly(folderScope),
    deletionItems: readonly(deletionItems),
    isDeletingAssets: readonly(isDeletingAssets),

    // Actions
    fetchAssets,
    clearError,
    uploadFiles,
    uploadFromUrl,
    deleteAssets,
    clearDeletionHistory,
    refreshAssets,
    loadMoreAssets,
    fetchFolders,
    createFolder,
    deleteFolder,
    moveAssets,
    setFolderScope,

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
