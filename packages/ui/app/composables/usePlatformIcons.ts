export type SocialMediaPlatform = 'default'
  | 'facebook'
  | 'instagram'
  | 'instagram-standalone'
  | 'twitter'
  | 'tiktok'
  | 'google'
  | 'googlemybusiness'
  | 'discord'
  | 'linkedin'
  | 'linkedin-page'
  | 'threads'
  | 'youtube'
  | 'bluesky'
  | 'devto'
  | 'dribbble'
  | 'reddit'
  | 'wordpress'

/**
 * Composable for getting platform icon names
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */
export const usePlatformIcons = () => {
  const platformIconMap: Record<SocialMediaPlatform, string> = {
    facebook: 'logos:facebook',
    instagram: 'logos:instagram-icon',
    twitter: 'logos:twitter',
    google: 'logos:google-icon',
    linkedin: 'logos:linkedin-icon',
    tiktok: 'logos:tiktok-icon',
    threads: 'fa6-brands:square-threads',
    youtube: 'logos:youtube-icon',
    googlemybusiness: 'logos:google-icon',
    bluesky: 'logos:bluesky',
    reddit: 'logos:reddit-icon',
    discord: 'logos:discord-icon',
    dribbble: 'logos:dribbble-icon',
    devto: 'simple-icons:devdotto',
    wordpress: 'logos:wordpress-icon',
    'instagram-standalone': 'logos:instagram-icon',
    default: "i-lucide-globe",
    "linkedin-page": "logos:linkedin-icon",
  }

  /**
   * Get the icon name for a platform
   */
  const getPlatformIcon = (platform: SocialMediaPlatform): string => {
    return platformIconMap[platform] || platformIconMap.default
  }

  /**
   * Get all supported platforms with their icons
   */
  const getAllPlatformIcons = (): Record<SocialMediaPlatform, string> => {
    return { ...platformIconMap }
  }

  /**
   * Check if a platform is supported
   */
  const isPlatformSupported = (platform: string): platform is SocialMediaPlatform => {
    return platform in platformIconMap
  }

  return {
    getPlatformIcon,
    getAllPlatformIcons,
    isPlatformSupported,
    platformIconMap,
  }
}
