

import type { Post, PostCreateBase, PostWithAllData } from '#layers/BaseDB/db/posts/posts'
import type { PaginatedResponse, PaginationOptions, } from '#layers/BaseDB/server/services/types'

import type { ApiResponse, PostFilters, PostStats, ValidationResult, PlatformPostStatus } from '#layers/BaseScheduler/server/utils/SchedulerTypes'
/**
 * Post Manager Composable for handling post operations
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */


export const usePostManager = () => {
  const { t } = useI18n()
  const toast = useToast()
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const postList = useState<PostWithAllData[]>('posts:list', () => [] as PostWithAllData[])
  const activeBusinessId = useState<string>('business:id');

  /**
   * Show platform status toasts
   */
  const showPlatformStatusToasts = (platformStatuses: PlatformPostStatus[], action: 'created' | 'updated') => {
    if (!platformStatuses || platformStatuses.length === 0) {
      const title = action === 'created' ? t('toast.postCreated') : t('toast.postUpdated')
      toast.add({
        title,
        icon: 'i-heroicons-check-circle',
        color: 'success'
      })
      return
    }

    const hasErrors = platformStatuses.some(ps => ps.status === 'failed')
    const hasPending = platformStatuses.some(ps => ps.status === 'pending')
    const allSuccess = platformStatuses.every(ps => ps.status === 'published')

    if (allSuccess) {
      const title = action === 'created' ? t('toast.postCreated') : t('toast.postUpdated')
      const description = platformStatuses.map(ps => {
        const platformName = ps.platform.charAt(0).toUpperCase() + ps.platform.slice(1)
        return `✓ ${platformName}: ${t('toast.platformSuccess')}`
      }).join('\n')

      toast.add({
        title,
        description,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } else if (hasErrors) {
      platformStatuses.forEach(ps => {
        const platformName = ps.platform.charAt(0).toUpperCase() + ps.platform.slice(1)

        if (ps.status === 'published') {
          toast.add({
            title: `${platformName}: ${t('toast.platformSuccess')}`,
            icon: 'i-heroicons-check-circle',
            color: 'success'
          })
        } else if (ps.status === 'failed') {
          toast.add({
            title: `${platformName}: ${t('toast.platformFailed')}`,
            description: ps.errorMessage || t('toast.platformError'),
            icon: 'i-heroicons-x-circle',
            color: 'error',
          })
        } else if (ps.status === 'pending') {
          toast.add({
            title: `${platformName}: ${t('toast.platformPending')}`,
            icon: 'i-heroicons-clock',
            color: 'warning'
          })
        }
      })
    } else {
      const title = action === 'created' ? t('toast.postCreatedPending') : t('toast.postUpdatedPending')
      toast.add({
        title,
        icon: 'i-heroicons-clock',
        color: 'warning'
      })
    }
  }

  /**
   * Get posts with pagination and filtering
   */
  const getPosts = async (
    businessId: string,
    pagination: PaginationOptions = { page: 1, limit: 100 },
    filters: PostFilters = {}
  ) => {
    isLoading.value = true
    error.value = null

    try {
      const query = new URLSearchParams({
        businessId,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...filters
      })

      const { data: response } = await useFetch<PaginatedResponse<PostWithAllData>>(`/api/v1/posts?${query}`)


      postList.value = response.value?.data ?? []
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch posts'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create a new post
   */
  const createPost = async (postData: PostCreateBase) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ApiResponse<Post>>('/api/v1/posts', {
        method: 'POST',
        body: {
          ...postData,
          scheduledAt: postData.scheduledAt?.toISOString()
        }
      })

      showPlatformStatusToasts(response.platformStatuses || [], 'created')
      return response
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to create post'
      toast.add({ title: t('toast.postCreatedFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update an existing post
   */
  const updatePost = async (postId: string, postData: PostCreateBase) => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<ApiResponse<Post>>(`/api/v1/posts/${postId}`, {
        method: 'PUT',
        body: {
          ...postData,
          scheduledAt: postData.scheduledAt?.toISOString()
        }
      });

      showPlatformStatusToasts(response.platformStatuses || [], 'updated');
      return response;
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to update post';
      toast.add({ title: t('toast.postUpdatedFailed'), icon: 'i-heroicons-x-circle', color: 'error' });
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Get scheduled posts
   */
  const getScheduledPosts = async (beforeDate?: Date) => {
    isLoading.value = true
    error.value = null

    try {
      const query = beforeDate ? `?before=${beforeDate.toISOString()}` : ''
      const response = await $fetch<ApiResponse<Post[]>>(`/api/v1/posts/scheduled${query}`)
      return response
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch scheduled posts'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get post statistics
   */
  const getPostStats = async (
    businessId: string,
    startDate?: string,
    endDate?: string
  ) => {
    isLoading.value = true
    error.value = null

    try {
      const query = new URLSearchParams({ businessId })
      if (startDate) query.append('startDate', startDate)
      if (endDate) query.append('endDate', endDate)

      const response = await $fetch<ApiResponse<PostStats>>(`/api/v1/posts/stats?${query}`)
      return response
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch post stats'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Validate post content
   */
  const validatePostContent = async (
    content: string,
    platforms?: string[],
    socialAccountIds?: string[],
    mediaUrls?: string[]
  ) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ApiResponse<ValidationResult>>('/api/v1/posts/validate', {
        method: 'POST',
        body: {
          content,
          platforms,
          socialAccountIds,
          mediaUrls
        }
      })
      return response
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to validate post content'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const deletePost = async (postId: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<ApiResponse<Post>>(`/api/v1/posts/${postId}`, {
        method: 'DELETE'
      })
      await getPosts(activeBusinessId.value)
      return response
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to delete post'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    isLoading: readonly(isLoading),
    error: readonly(error),
    postList,
    activeBusinessId,

    // Methods
    getPosts,
    createPost,
    updatePost,
    deletePost,
    getScheduledPosts,
    getPostStats,
    validatePostContent,
    t,

    // Utilities
    clearError: () => error.value = null
  }
}
