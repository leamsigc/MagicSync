/**
 * Defines platform-specific configurations for social media posts,
 * including restrictions and supported features for various platforms.
 * This file serves as the single source of truth for both UI validation and server-side enforcement.
 */
export type PostFormat = 'post' | 'reel' | 'story' | 'short';

export interface PlatformConfig {
    icon: string;
    color: string;
    maxPostLength: number;
    maxImages: number;
    supportsComments: boolean;
    supportsImagesInComments: boolean;
    supportsCarousel: boolean;
    supportsVideo: boolean;
    maxVideoLengthSeconds?: number;
    supportsLinkPreviews: boolean;
    supportsTags?: boolean;
    supportsCategories?: boolean;
    supportsPrivacySettings?: boolean;
    supportsSounds?: boolean;
    supportsShorts?: boolean;
    supportsStories?: boolean;
    maxConcurrentJob?: number;
    supportedFormats: PostFormat[];
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
        icon: 'i-heroicons-globe-alt',
        color: '#6B7280',
        maxPostLength: 100000,
        maxImages: 10,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 72000,
        supportsLinkPreviews: true,
        supportsTags: true,
        supportsCategories: true,
        supportsPrivacySettings: true,
        supportsSounds: true,
        supportsShorts: true,
        supportsStories: true,
        maxConcurrentJob: 10,
        supportedFormats: ['post', 'reel', 'story', 'short'],
    },
    facebook: {
        icon: 'i-simple-icons-facebook',
        color: '#1877F2',
        maxPostLength: 63206,
        maxImages: 10,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 14400,
        supportsLinkPreviews: true,
        supportsStories: true,
        maxConcurrentJob: 10,
        supportedFormats: ['post', 'reel', 'story'],
    },
    instagram: {
        icon: 'i-simple-icons-instagram',
        color: '#E4405F',
        maxPostLength: 2200,
        maxImages: 10,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 3600,
        supportsLinkPreviews: false,
        supportsStories: true,
        maxConcurrentJob: 2,
        supportedFormats: ['post', 'reel', 'story'],
    },
    'instagram-standalone': {
        icon: 'i-simple-icons-instagram',
        color: '#E4405F',
        maxPostLength: 2200,
        maxImages: 10,
        supportsComments: false,
        supportsImagesInComments: false,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 60,
        supportsLinkPreviews: false,
        supportsStories: false,
        maxConcurrentJob: 1,
        supportedFormats: ['post'],
    },
    twitter: {
        icon: 'i-simple-icons-x',
        color: '#000000',
        maxPostLength: 280,
        maxImages: 4,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 140,
        supportsLinkPreviews: true,
        maxConcurrentJob: 1,
        supportedFormats: ['post'],
    },
    x: {
        icon: 'i-simple-icons-x',
        color: '#000000',
        maxPostLength: 280,
        maxImages: 4,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 140,
        supportsLinkPreviews: true,
        maxConcurrentJob: 1,
        supportedFormats: ['post'],
    },
    google: {
        icon: 'i-simple-icons-google',
        color: '#4285F4',
        maxPostLength: 1500,
        maxImages: 1,
        supportsComments: false,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 30,
        supportsLinkPreviews: true,
        maxConcurrentJob: 5,
        supportedFormats: ['post'],
    },
    'email-password': {
        icon: 'i-heroicons-envelope',
        color: '#6B7280',
        maxPostLength: 5000,
        maxImages: 5,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 600,
        supportsLinkPreviews: true,
        maxConcurrentJob: 10,
        supportedFormats: ['post'],
    },
    linkedin: {
        icon: 'i-simple-icons-linkedin',
        color: '#0A66C2',
        maxPostLength: 3000,
        maxImages: 9,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 600,
        supportsLinkPreviews: true,
        maxConcurrentJob: 2,
        supportedFormats: ['post'],
    },
    'linkedin-page': {
        icon: 'i-simple-icons-linkedin',
        color: '#0A66C2',
        maxPostLength: 3000,
        maxImages: 9,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 600,
        supportsLinkPreviews: true,
        maxConcurrentJob: 2,
        supportedFormats: ['post'],
    },
    tiktok: {
        icon: 'i-simple-icons-tiktok',
        color: '#000000',
        maxPostLength: 2200,
        maxImages: 0,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 600,
        supportsLinkPreviews: false,
        supportsSounds: true,
        supportsShorts: true,
        maxConcurrentJob: 2,
        supportedFormats: ['short'],
    },
    threads: {
        icon: 'i-simple-icons-threads',
        color: '#000000',
        maxPostLength: 500,
        maxImages: 10,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 300,
        supportsLinkPreviews: true,
        maxConcurrentJob: 3,
        supportedFormats: ['post'],
    },
    youtube: {
        icon: 'i-simple-icons-youtube',
        color: '#FF0000',
        maxPostLength: 5000,
        maxImages: 0,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 43200,
        supportsLinkPreviews: true,
        supportsTags: true,
        supportsCategories: true,
        supportsPrivacySettings: true,
        supportsShorts: true,
        maxConcurrentJob: 1,
        supportedFormats: ['post', 'short'],
    },
    pinterest: {
        icon: 'i-simple-icons-pinterest',
        color: '#E60023',
        maxPostLength: 500,
        maxImages: 1,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: true,
        supportsVideo: true,
        maxVideoLengthSeconds: 900,
        supportsLinkPreviews: true,
        maxConcurrentJob: 5,
        supportedFormats: ['post'],
    },
    mastodon: {
        icon: 'i-simple-icons-mastodon',
        color: '#6364FF',
        maxPostLength: 500,
        maxImages: 4,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 300,
        supportsLinkPreviews: true,
        maxConcurrentJob: 5,
        supportedFormats: ['post'],
    },
    bluesky: {
        icon: 'i-simple-icons-bluesky',
        color: '#0085FF',
        maxPostLength: 300,
        maxImages: 4,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: false,
        supportsLinkPreviews: true,
        maxConcurrentJob: 5,
        supportedFormats: ['post'],
    },
    reddit: {
        icon: 'i-simple-icons-reddit',
        color: '#FF4500',
        maxPostLength: 40000,
        maxImages: 1,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 900,
        supportsLinkPreviews: true,
        supportsTags: true,
        maxConcurrentJob: 1,
        supportedFormats: ['post'],
    },
    discord: {
        icon: 'i-simple-icons-discord',
        color: '#5865F2',
        maxPostLength: 2000,
        maxImages: 10,
        supportsComments: true,
        supportsImagesInComments: true,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 600,
        supportsLinkPreviews: true,
        maxConcurrentJob: 5,
        supportedFormats: ['post'],
    },
    dribbble: {
        icon: 'i-simple-icons-dribbble',
        color: '#EA4C89',
        maxPostLength: 500,
        maxImages: 1,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 60,
        supportsLinkPreviews: false,
        supportsTags: true,
        maxConcurrentJob: 2,
        supportedFormats: ['post'],
    },
    devto: {
        icon: 'i-simple-icons-devdotto',
        color: '#0A0A0A',
        maxPostLength: 25000,
        maxImages: 1,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: false,
        supportsLinkPreviews: true,
        supportsTags: true,
        maxConcurrentJob: 5,
        supportedFormats: ['post'],
    },
    wordpress: {
        icon: 'i-simple-icons-wordpress',
        color: '#21759B',
        maxPostLength: 100000,
        maxImages: 1,
        supportsComments: true,
        supportsImagesInComments: false,
        supportsCarousel: false,
        supportsVideo: true,
        maxVideoLengthSeconds: 72000,
        supportsLinkPreviews: true,
        supportsTags: true,
        supportsCategories: true,
        maxConcurrentJob: 5,
        supportedFormats: ['post'],
    },
};

