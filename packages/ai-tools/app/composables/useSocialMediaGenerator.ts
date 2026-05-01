/**
 * Social Media Generation Composable
 * 
 * Provides AI-powered social media post generation capabilities
 * with support for multiple platforms and content types.
 */

export interface GeneratedPost {
  text: string
  hashtags: string[]
  platform: string
  character_count: number
  warning?: string
}

export interface HookOption {
  hook: string
  hook_type: string
}

export interface PlatformInfo {
  name: string
  display_name: string
  limits: {
    platform: string
    max_length: number
    recommended_length?: number
    max_hashtags?: number
    max_images: number
    hashtag_placement: string
    link_handling: string
    supports_threads: boolean
  }
}

export interface GeneratePostOptions {
  topic: string
  platform: string
  tone?: 'professional' | 'casual' | 'humorous' | 'informative' | 'inspirational'
  include_hashtags?: boolean
  include_cta?: boolean
  additional_context?: string
  max_length?: number
}

export interface GenerateBatchOptions {
  topic: string
  platforms: string[]
  tone?: 'professional' | 'casual' | 'humorous' | 'informative' | 'inspirational'
  include_hashtags?: boolean
  include_cta?: boolean
  count_per_platform?: number
}

export interface GenerateThreadOptions {
  topic: string
  platform?: 'twitter' | 'threads' | 'bluesky'
  tweet_count?: number
  hook_first?: boolean
}

export interface GenerateVariationsOptions {
  base_content: string
  platform: string
  count?: number
  variation_type?: 'rephrase' | 'expand' | 'shorten'
}

export interface GenerateHooksOptions {
  topic: string
  platform: string
  count?: number
}

export interface GenerateHashtagsOptions {
  topic: string
  platform: string
  count?: number
  style?: 'popular' | 'niche' | 'mixed' | 'trending'
}

export const useSocialMediaGenerator = () => {
  const loading = useState<boolean>('social-media:loading', () => false)
  const error = useState<string | null>('social-media:error', () => null)
  const platforms = useState<PlatformInfo[]>('social-media:platforms', () => [])
  const lastGenerated = useState<GeneratedPost | null>('social-media:last', () => null)

  /**
   * Generate a single social media post
   */
  const generatePost = async (options: GeneratePostOptions): Promise<GeneratedPost | null> => {
    loading.value = true
    error.value = null

    try {
      const result = await $fetch<{
        post?: GeneratedPost
        error?: string
      }>('/api/ai-tools/social-media/generate', {
        method: 'POST',
        body: options,
      })

      if (result.error) {
        error.value = result.error
        return null
      }

      if (result.post) {
        lastGenerated.value = result.post
        return result.post
      }

      return null
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to generate post'
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Generate posts for multiple platforms at once
   */
  const generateBatch = async (options: GenerateBatchOptions): Promise<Record<string, GeneratedPost[]>> => {
    loading.value = true
    error.value = null

    try {
      const result = await $fetch<{
        posts: Record<string, GeneratedPost[]>
        generated_count: number
        errors?: string[]
      }>('/api/ai-tools/social-media/generate-batch', {
        method: 'POST',
        body: options,
      })

      if (result.errors && result.errors.length > 0) {
        console.warn('Some posts failed to generate:', result.errors)
      }

      return result.posts
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to generate batch'
      return {}
    } finally {
      loading.value = false
    }
  }

  /**
   * Generate a thread/tweetstorm
   */
  const generateThread = async (options: GenerateThreadOptions): Promise<GeneratedPost[]> => {
    loading.value = true
    error.value = null

    try {
      const result = await $fetch<{
        thread?: GeneratedPost[]
        tweet_count?: number
        error?: string
      }>('/api/ai-tools/social-media/generate-thread', {
        method: 'POST',
        body: options,
      })

      if (result.error) {
        error.value = result.error
        return []
      }

      return result.thread || []
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to generate thread'
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Generate variations of existing content
   */
  const generateVariations = async (options: GenerateVariationsOptions): Promise<GeneratedPost[]> => {
    loading.value = true
    error.value = null

    try {
      const result = await $fetch<{
        variations?: GeneratedPost[]
        count?: number
        error?: string
      }>('/api/ai-tools/social-media/generate-variations', {
        method: 'POST',
        body: options,
      })

      if (result.error) {
        error.value = result.error
        return []
      }

      return result.variations || []
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to generate variations'
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Generate hook options for a topic
   */
  const generateHooks = async (options: GenerateHooksOptions): Promise<HookOption[]> => {
    loading.value = true
    error.value = null

    try {
      const result = await $fetch<{
        hooks?: HookOption[]
        count?: number
        error?: string
      }>('/api/ai-tools/social-media/generate-hooks', {
        method: 'POST',
        body: options,
      })

      if (result.error) {
        error.value = result.error
        return []
      }

      return result.hooks || []
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to generate hooks'
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Generate hashtag suggestions
   */
  const generateHashtags = async (options: GenerateHashtagsOptions): Promise<string[]> => {
    loading.value = true
    error.value = null

    try {
      const result = await $fetch<{
        hashtags?: string[]
        count?: number
        error?: string
      }>('/api/ai-tools/social-media/generate-hashtags', {
        method: 'POST',
        body: options,
      })

      if (result.error) {
        error.value = result.error
        return []
      }

      return result.hashtags || []
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to generate hashtags'
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch supported platforms with their limits
   */
  const fetchPlatforms = async (): Promise<void> => {
    try {
      const result = await $fetch<PlatformInfo[]>('/api/ai-tools/social-media/platforms')
      platforms.value = result
    } catch (err: any) {
      console.error('Failed to fetch platforms:', err)
    }
  }

  /**
   * Get platform info by name
   */
  const getPlatform = (name: string): PlatformInfo | undefined => {
    return platforms.value.find(p => p.name === name)
  }

  /**
   * Get character limit for a platform
   */
  const getCharacterLimit = (name: string): number => {
    const platform = getPlatform(name)
    return platform?.limits.max_length || 280
  }

  /**
   * Check if content fits platform limits
   */
  const checkPlatformFit = (platform: string, content: string): { fits: boolean; overflow: number } => {
    const limit = getCharacterLimit(platform)
    const fits = content.length <= limit
    return {
      fits,
      overflow: fits ? 0 : content.length - limit
    }
  }

  return {
    // State
    loading: readonly(loading),
    error: readonly(error),
    platforms: readonly(platforms),
    lastGenerated: readonly(lastGenerated),

    // Generation methods
    generatePost,
    generateBatch,
    generateThread,
    generateVariations,
    generateHooks,
    generateHashtags,

    // Utility methods
    fetchPlatforms,
    getPlatform,
    getCharacterLimit,
    checkPlatformFit,
  }
}
