

import type { Post, PostCreateBase, PostWithAllData } from '#layers/BaseDB/db/posts/posts'
import type { PaginatedResponse, PaginationOptions, } from '#layers/BaseDB/server/services/types'

import type { ApiResponse, PostFilters, PostStats, ValidationResult } from '#layers/BaseScheduler/server/utils/SchedulerTypes'
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

      const response = await $fetch<PaginatedResponse<PostWithAllData>>(`/api/v1/posts?${query}`)


      postList.value = response.data ?? []
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
      toast.add({ title: t('toast.postCreated'), icon: 'i-heroicons-check-circle', color: 'success' })
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
      return response;
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to update post';
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
