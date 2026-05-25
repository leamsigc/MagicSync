interface GoogleDriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  iconLink: string
  thumbnailLink?: string
  size?: string
  modifiedTime?: string
}

interface GoogleDriveListResponse {
  success: boolean
  files: GoogleDriveFile[]
  nextPageToken?: string
  message?: string
}

interface DownloadGoogleDriveResponse {
  success: boolean
  data: import('#layers/BaseDB/db/schema').Asset[]
  message: string
}

export const useGoogleDrive = () => {
  const files = ref<GoogleDriveFile[]>([])
  const selectedFiles = ref<GoogleDriveFile[]>([])
  const isLoading = ref(false)
  const isDownloading = ref(false)
  const error = ref<string | null>(null)
  const nextPageToken = ref<string | undefined>(undefined)
  const query = ref('')
  const totalFiles = ref(0)
  const pageSize = ref(15)

  const toast = useToast()

  const clearError = () => {
    error.value = null
  }

  const listFiles = async (pageToken?: string) => {
    isLoading.value = true
    error.value = null
    try {
      const response = await $fetch<GoogleDriveListResponse>('/api/v1/assets/google-drive/list', {
        query: {
          query: query.value || undefined,
          pageSize: pageSize.value,
          pageToken: pageToken || undefined,
        },
      })
      if (!response.success) {
        throw new Error(response.message || 'Failed to list files')
      }
      if (pageToken) {
        files.value.push(...response.files)
      } else {
        files.value = response.files
      }
      nextPageToken.value = response.nextPageToken
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to list Google Drive files'
      toast.add({
        title: 'Error',
        description: error.value,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    } finally {
      isLoading.value = false
    }
  }

  const searchFiles = async () => {
    await listFiles()
  }

  const loadNextPage = async () => {
    if (nextPageToken.value && !isLoading.value) {
      await listFiles(nextPageToken.value)
    }
  }

  const loadPrevPage = async () => {
    files.value = []
    nextPageToken.value = undefined
    await listFiles()
  }

  const toggleSelectFile = (file: GoogleDriveFile) => {
    const index = selectedFiles.value.findIndex((f) => f.id === file.id)
    if (index > -1) {
      selectedFiles.value.splice(index, 1)
    } else {
      selectedFiles.value.push(file)
    }
  }

  const clearSelectedFiles = () => {
    selectedFiles.value = []
  }

  const hasNextPage = computed(() => !!nextPageToken.value)

  const downloadSelectedFiles = async (): Promise<import('#layers/BaseDB/db/schema').Asset[]> => {
    if (selectedFiles.value.length === 0) return []
    isDownloading.value = true
    error.value = null
    try {
      const response = await $fetch<DownloadGoogleDriveResponse>('/api/v1/assets/google-drive/download', {
        method: 'POST',
        body: { files: selectedFiles.value },
      })
      if (!response.success) {
        throw new Error(response.message || 'Failed to download files')
      }
      toast.add({
        title: 'Success',
        description: response.message,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      clearSelectedFiles()
      return response.data
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to download files'
      toast.add({
        title: 'Error',
        description: error.value,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
      return []
    } finally {
      isDownloading.value = false
    }
  }

  return {
    files,
    selectedFiles,
    isLoading,
    isDownloading,
    error,
    query,
    nextPageToken,
    totalFiles,
    pageSize,
    clearError,
    listFiles,
    searchFiles,
    loadNextPage,
    loadPrevPage,
    toggleSelectFile,
    clearSelectedFiles,
    downloadSelectedFiles,
    hasNextPage,
  }
}