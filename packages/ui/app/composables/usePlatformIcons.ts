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
    google: 'logos:google',
    linkedin: 'logos:linkedin-icon',
    tiktok: 'logos:tiktok',
    threads: 'logos:threads',
    youtube: 'logos:youtube',
    googlemybusiness: 'logos:google',
    bluesky: 'logos:bluesky',
    reddit: 'logos:reddit',
    discord: 'logos:discord',
    dribbble: 'logos:dribbble',
    devto: 'logos:devdotto',
    wordpress: 'logos:wordpress',
    'instagram-standalone': 'logos:instagram-icon',
    default: "logos:globe-alt",
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
