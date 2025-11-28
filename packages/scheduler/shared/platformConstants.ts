/**
 * Defines platform-specific configurations for social media posts,
 * including restrictions and supported features for various platforms.
 * This file serves as the single source of truth for both UI validation and server-side enforcement.
 */
export interface PlatformConfig {
    /** Maximum length of post content in characters */
    maxPostLength: number;
    /** Maximum number of images allowed per post */
    maxImages: number;
    /** Whether the platform supports comments */
    supportsComments: boolean;
    /** Whether the platform supports images in comments */
    supportsImagesInComments: boolean;
    /** Whether the platform supports carousel posts (multiple images/videos) */
    supportsCarousel: boolean;
    /** Whether the platform supports video posts */
    supportsVideo: boolean;
    /** Maximum video duration in seconds (optional) */
    maxVideoLengthSeconds?: number;
    /** Whether the platform supports link previews */
    supportsLinkPreviews: boolean;
    /** Whether the platform supports tags/hashtags */
    supportsTags?: boolean;
    /** Whether the platform supports categories */
    supportsCategories?: boolean;
    /** Whether the platform supports privacy settings (public, private, etc.) */
    supportsPrivacySettings?: boolean;
    /** Whether the platform supports sound/audio features */
    supportsSounds?: boolean;
    /** Whether the platform supports short-form video (Shorts, Reels, TikToks) */
    supportsShorts?: boolean;
    /** Whether the platform supports stories */
    supportsStories?: boolean;
    /** Maximum number of concurrent jobs/requests allowed (for rate limiting) */
    maxConcurrentJob?: number;
}

export interface SocialMediaPlatformConfigurations {
    facebook: PlatformConfig;
    instagram: PlatformConfig;
    twitter: PlatformConfig; // X (Twitter)
    x: PlatformConfig; // Alias for twitter
    google: PlatformConfig; // Google Business Profile
    'email-password': PlatformConfig; // Custom/Internal
    linkedin: PlatformConfig; // Personal Profile
    'linkedin-page': PlatformConfig; // Organization Page
    tiktok: PlatformConfig;
    threads: PlatformConfig;
    youtube: PlatformConfig;
    pinterest: PlatformConfig;
    mastodon: PlatformConfig;
    bluesky: PlatformConfig;
    reddit: PlatformConfig;
    discord: PlatformConfig;
    dribbble: PlatformConfig;
    devto: PlatformConfig; // dev.to
    wordpress: PlatformConfig;
    default: PlatformConfig;
    'instagram-standalone': PlatformConfig; // Legacy Basic Display
}

export const platformConfigurations: SocialMediaPlatformConfigurations = {
    default: {
        maxPostLength: 100000, // Very large default
        maxImages: 10,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 72000, // 20 hours
        supportsLinkPreviews: true,
        supportsTags: true,
        supportsCategories: true,
        supportsPrivacySettings: true,
        supportsSounds: true,
        supportsShorts: true,
        supportsStories: true,
        maxConcurrentJob: 10,
    },
    facebook: {
        maxPostLength: 63206,
        maxImages: 10,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 14400, // 4 hours
        supportsLinkPreviews: true,
        supportsStories: true,
        maxConcurrentJob: 10,
    },
    instagram: {
        maxPostLength: 2200,
        maxImages: 10,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 3600, // 60 mins (Reels)
        supportsLinkPreviews: false,
        supportsStories: true,
        maxConcurrentJob: 2, // 100 posts/24hrs -> conservative limit
    },
    'instagram-standalone': {
        maxPostLength: 2200,
        maxImages: 10,
        supportsComments: false, // Deprecated
        supportsImagesInComments: false,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 60,
        supportsLinkPreviews: false,
        supportsStories: false,
        maxConcurrentJob: 1,
    },
    twitter: {
        maxPostLength: 280, // Standard limit (Premium is 4000, handled in plugin logic)
        maxImages: 4,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 140, // 2 mins 20 secs
        supportsLinkPreviews: true,
        maxConcurrentJob: 1, // 300 posts/3hrs -> strict limit
    },
    x: { // Alias for twitter
        maxPostLength: 280,
        maxImages: 4,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 140,
        supportsLinkPreviews: true,
        maxConcurrentJob: 1,
    },
    google: { // Google Business Profile
        maxPostLength: 1500,
        maxImages: 1,
        supportsComments: false, // GMB doesn't support standard comments on posts in the same way
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 30,
        supportsLinkPreviews: true,
        maxConcurrentJob: 5,
    },
    'email-password': {
        maxPostLength: 5000,
        maxImages: 5,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 600,
        supportsLinkPreviews: true,
        maxConcurrentJob: 10,
    },
    linkedin: {
        maxPostLength: 3000,
        maxImages: 9,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: true, // Document posts act as carousels
        supportsVideo: true,
        maxVideoLengthSeconds: 600, // 10 mins
        supportsLinkPreviews: true,
        maxConcurrentJob: 2, // Professional limits
    },
    'linkedin-page': {
        maxPostLength: 3000,
        maxImages: 9,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 600,
        supportsLinkPreviews: true,
        maxConcurrentJob: 2,
    },
    tiktok: {
        maxPostLength: 2200,
        maxImages: 0, // Video only
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false, // Photo mode exists but API focuses on video
        supportsVideo: true,
        maxVideoLengthSeconds: 600, // 10 mins
        supportsLinkPreviews: false,
        supportsSounds: true,
        supportsShorts: true,
        maxConcurrentJob: 2,
    },
    threads: {
        maxPostLength: 500,
        maxImages: 10,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 300, // 5 mins
        supportsLinkPreviews: true,
        maxConcurrentJob: 3, // 250 posts/24hrs
    },
    youtube: {
        maxPostLength: 5000, // Description limit
        maxImages: 0, // Video only
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 43200, // 12 hours
        supportsLinkPreviews: true,
        supportsTags: true,
        supportsCategories: true,
        supportsPrivacySettings: true,
        supportsShorts: true,
        maxConcurrentJob: 1, // Strict quota limits
    },
    pinterest: {
        maxPostLength: 500,
        maxImages: 1,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 900, // 15 mins
        supportsLinkPreviews: true,
        maxConcurrentJob: 5,
    },
    mastodon: {
        maxPostLength: 500,
        maxImages: 4,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 300, // Server dependent, usually 5 mins
        supportsLinkPreviews: true,
        maxConcurrentJob: 5,
    },
    bluesky: {
        maxPostLength: 300,
        maxImages: 4,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: false, // Not yet in API?
        supportsLinkPreviews: true,
        maxConcurrentJob: 5,
    },
    reddit: {
        maxPostLength: 40000, // Self-post limit
        maxImages: 1, // Gallery support varies, sticking to 1 for now
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 900, // 15 mins
        supportsLinkPreviews: true,
        supportsTags: true, // Flair
        maxConcurrentJob: 1, // 1 req/sec strict
    },
    discord: {
        maxPostLength: 2000,
        maxImages: 10,
        supportsComments: true, // Replies
        supportsImagesInComments: true,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 600, // File size limit dependent
        supportsLinkPreviews: true,
        maxConcurrentJob: 5,
    },
    dribbble: {
        maxPostLength: 500, // Description
        maxImages: 1, // Single shot
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 60,
        supportsLinkPreviews: false,
        supportsTags: true,
        maxConcurrentJob: 2, // 60 req/min
    },
    devto: {
        maxPostLength: 25000,
        maxImages: 1, // Cover image
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: false,
        supportsLinkPreviews: true,
        supportsTags: true,
        maxConcurrentJob: 5,
    },
    wordpress: {
        maxPostLength: 100000, // Unlimited effectively
        maxImages: 1, // Featured image
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 72000,
        supportsLinkPreviews: true,
        supportsTags: true,
        supportsCategories: true,
        maxConcurrentJob: 5,
    },
};
