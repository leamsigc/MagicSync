/**
 * Single Asset Operations Composable
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the composable
 * @todo [ ] Integration test
 * @todo [✔] Update the typescript
 */

import type { Asset } from "#layers/BaseDB/db/schema"


export type AssetType = 'image' | 'video' | 'document' | 'other'

export interface AssetMetadata {
  width?: number
  height?: number
  duration?: number
  format?: string
  [key: string]: any
}

export interface CreateAssetData {
  businessId: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  thumbnailUrl?: string
  metadata?: AssetMetadata
}

export const useAsset = () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const getAssetType = (mimeType: string): AssetType => {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document'
    return 'other'
  }

  const isImageAsset = (mimeType: string): boolean => {
    return mimeType.startsWith('image/')
  }

  const isVideoAsset = (mimeType: string): boolean => {
    return mimeType.startsWith('video/')
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || ''
  }

  const createAsset = async (data: CreateAssetData): Promise<Asset | null> => {
    isLoading.value = true
    error.value = null

    try {
      const { data: result } = await $fetch<{ success: boolean; data: Asset; error?: string }>('/api/v1/assets', {
        method: 'POST',
        body: data
      })

      if (!result) {
        throw new Error('Failed to create asset')
      }

      return result
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to create asset'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const fetchAsset = async (id: string): Promise<Asset | null> => {
    isLoading.value = true
    error.value = null

    try {
      const { data: result } = await $fetch<{ success: boolean; data: Asset; error?: string }>(`/api/v1/assets/${id}`)

      if (!result) {
        throw new Error('Asset not found')
      }

      return result
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch asset'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const deleteAsset = async (id: string): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      await $fetch(`/api/v1/assets/${id}`, {
        method: 'DELETE'
      })

      return true
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to delete asset'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const updateAssetMetadata = async (id: string, metadata: AssetMetadata): Promise<Asset | null> => {
    isLoading.value = true
    error.value = null

    try {
      const { data: result } = await $fetch<{ success: boolean; data: Asset; error?: string }>(`/api/v1/assets/${id}`, {
        method: 'PUT',
        body: { metadata }
      })

      if (!result) {
        throw new Error('Failed to update asset metadata')
      }

      return result
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to update asset metadata'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const getAssetPreviewUrl = (asset: Asset): string => {
    // Return thumbnail if available, otherwise return main URL
    return asset.thumbnailUrl || asset.url
  }

  const getAssetDisplayName = (asset: Asset): string => {
    return asset.originalName || asset.filename
  }

  const parseAssetMetadata = (asset: Asset): AssetMetadata => {
    if (!asset.metadata) return {}

    try {
      return typeof asset.metadata === 'string'
        ? JSON.parse(asset.metadata)
        : asset.metadata
    } catch {
      return {}
    }
  }

  const downloadAsset = async (asset: Asset): Promise<void> => {
    try {
      // Create a temporary link to download the file
      const link = document.createElement('a')
      link.href = asset.url
      link.download = asset.originalName
      link.target = '_blank'

      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      log.error({ message: 'Download failed', error: String(error) })
      throw new Error('Failed to download asset')
    }
  }

  return {
    // State
    isLoading: readonly(isLoading),
    error: readonly(error),

    // Actions
    createAsset,
    fetchAsset,
    deleteAsset,
    updateAssetMetadata,
    downloadAsset,

    // Utilities
    getAssetType,
    isImageAsset,
    isVideoAsset,
    formatFileSize,
    getFileExtension,
    getAssetPreviewUrl,
    getAssetDisplayName,
    parseAssetMetadata
  }
}
