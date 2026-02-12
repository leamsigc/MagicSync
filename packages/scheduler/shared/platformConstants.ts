/**
 * Defines platform-specific configurations for social media posts,
 * including restrictions and supported features for various platforms.
 * This file serves as the single source of truth for both UI validation and server-side enforcement.
 */
export type PostFormat = 'post' | 'reel' | 'story' | 'short';

export interface MediaConstraints {
  imageFileTypes: string[]; // Supported image formats (e.g., ['JPEG', 'PNG', 'GIF', 'WebP'])
  videoFileTypes: string[]; // Supported video formats (e.g., ['MP4', 'MOV', 'AVI'])
  maxImageSizeMB: number; // Maximum image file size in MB
  maxVideoSizeMB: number; // Maximum video file size in MB
  maxVideoLengthSeconds: number; // Maximum video duration in seconds
  aspectRatios: {
    min: number; // Minimum aspect ratio (e.g., 0.8 for 4:5)
    max: number; // Maximum aspect ratio (e.g., 1.91 for 1.91:1)
    recommended: string[]; // Recommended aspect ratios (e.g., ['1:1', '4:5', '16:9'])
  };
  supportsDocuments: boolean; // Whether platform supports document uploads
  documentFileTypes?: string[]; // Supported document formats (e.g., ['PDF'])
  maxDocumentSizeMB?: number; // Maximum document file size in MB
}

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
  mediaConstraints: MediaConstraints; // NEW: Detailed media validation constraints
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
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'GIF', 'WebP'],
      videoFileTypes: ['MP4', 'MOV', 'AVI', 'WebM'],
      maxImageSizeMB: 10,
      maxVideoSizeMB: 1024,
      maxVideoLengthSeconds: 72000,
      aspectRatios: {
        min: 0.5,
        max: 2.0,
        recommended: ['1:1', '4:5', '16:9'],
      },
      supportsDocuments: false,
    },
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
    maxVideoLengthSeconds: 14400, // 240 minutes
    supportsLinkPreviews: true,
    supportsStories: true,
    maxConcurrentJob: 10,
    supportedFormats: ['post', 'reel', 'story'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG'],
      videoFileTypes: ['MP4', 'MOV'],
      maxImageSizeMB: 4,
      maxVideoSizeMB: 10240, // 10 GB
      maxVideoLengthSeconds: 14400,
      aspectRatios: {
        min: 0.56, // 9:16 for stories
        max: 1.91,
        recommended: ['1:1', '4:5', '16:9', '9:16'],
      },
      supportsDocuments: false,
    },
  },
  instagram: {
    icon: 'i-simple-icons-instagram',
    color: '#1877F2',
    maxPostLength: 2200,
    maxImages: 10, // Carousel support
    supportsComments: true,
    supportsImagesInComments: false,
    supportsCarousel: true,
    supportsVideo: true,
    maxVideoLengthSeconds: 3600, // 60 minutes for feed, 90 seconds for reels
    supportsLinkPreviews: false,
    supportsStories: true,
    maxConcurrentJob: 2,
    supportedFormats: ['post', 'reel', 'story'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG'],
      videoFileTypes: ['MP4', 'MOV'],
      maxImageSizeMB: 8,
      maxVideoSizeMB: 100,
      maxVideoLengthSeconds: 3600,
      aspectRatios: {
        min: 0.8, // 4:5 portrait - CRITICAL for feed posts
        max: 1.91, // 1.91:1 landscape
        recommended: ['1:1', '4:5', '9:16'], // 9:16 for reels/stories
      },
      supportsDocuments: false,
    },
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
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG'],
      videoFileTypes: ['MP4'],
      maxImageSizeMB: 8,
      maxVideoSizeMB: 100,
      maxVideoLengthSeconds: 60,
      aspectRatios: {
        min: 0.8,
        max: 1.91,
        recommended: ['1:1', '4:5'],
      },
      supportsDocuments: false,
    },
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
    maxVideoLengthSeconds: 140, // 2 minutes 20 seconds
    supportsLinkPreviews: true,
    maxConcurrentJob: 1,
    supportedFormats: ['post'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'GIF', 'WebP'],
      videoFileTypes: ['MP4', 'MOV'],
      maxImageSizeMB: 5,
      maxVideoSizeMB: 512,
      maxVideoLengthSeconds: 140,
      aspectRatios: {
        min: 1.0, // 1:1
        max: 1.78, // 16:9
        recommended: ['1:1', '16:9'],
      },
      supportsDocuments: false,
    },
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
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'GIF', 'WebP'],
      videoFileTypes: ['MP4', 'MOV'],
      maxImageSizeMB: 5,
      maxVideoSizeMB: 512,
      maxVideoLengthSeconds: 140,
      aspectRatios: {
        min: 1.0,
        max: 1.78,
        recommended: ['1:1', '16:9'],
      },
      supportsDocuments: false,
    },
  },
  google: {
    icon: 'i-simple-icons-google',
    color: '#4285F4',
    maxPostLength: 1500,
    maxImages: 1, // Google Business only supports 1 image
    supportsComments: false,
    supportsImagesInComments: false,
    supportsCarousel: false,
    supportsVideo: false, // Videos not supported
    maxVideoLengthSeconds: 0,
    supportsLinkPreviews: true,
    maxConcurrentJob: 5,
    supportedFormats: ['post'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG'],
      videoFileTypes: [],
      maxImageSizeMB: 10,
      maxVideoSizeMB: 0,
      maxVideoLengthSeconds: 0,
      aspectRatios: {
        min: 0.75, // 3:4
        max: 1.33, // 4:3 recommended
        recommended: ['4:3'],
      },
      supportsDocuments: false,
    },
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
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'GIF'],
      videoFileTypes: ['MP4'],
      maxImageSizeMB: 5,
      maxVideoSizeMB: 50,
      maxVideoLengthSeconds: 600,
      aspectRatios: {
        min: 0.5,
        max: 2.0,
        recommended: ['1:1', '16:9'],
      },
      supportsDocuments: false,
    },
  },
  linkedin: {
    icon: 'i-simple-icons-linkedin',
    color: '#0A66C2',
    maxPostLength: 3000,
    maxImages: 20, // LinkedIn supports up to 20 images in carousel
    supportsComments: true,
    supportsImagesInComments: true,
    supportsCarousel: true,
    supportsVideo: true,
    maxVideoLengthSeconds: 600, // 10 minutes
    supportsLinkPreviews: true,
    maxConcurrentJob: 2,
    supportedFormats: ['post'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'GIF'],
      videoFileTypes: ['MP4', 'MOV', 'AVI'],
      maxImageSizeMB: 10,
      maxVideoSizeMB: 5120, // 5 GB
      maxVideoLengthSeconds: 600,
      aspectRatios: {
        min: 0.56, // 9:16
        max: 1.91, // 1.91:1
        recommended: ['1:1', '4:5', '16:9'],
      },
      supportsDocuments: true,
      documentFileTypes: ['PDF'],
      maxDocumentSizeMB: 100,
    },
  },
  'linkedin-page': {
    icon: 'i-simple-icons-linkedin',
    color: '#0A66C2',
    maxPostLength: 3000,
    maxImages: 20,
    supportsComments: true,
    supportsImagesInComments: true,
    supportsCarousel: true,
    supportsVideo: true,
    maxVideoLengthSeconds: 600,
    supportsLinkPreviews: true,
    maxConcurrentJob: 2,
    supportedFormats: ['post'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'GIF'],
      videoFileTypes: ['MP4', 'MOV', 'AVI'],
      maxImageSizeMB: 10,
      maxVideoSizeMB: 5120,
      maxVideoLengthSeconds: 600,
      aspectRatios: {
        min: 0.56,
        max: 1.91,
        recommended: ['1:1', '4:5', '16:9'],
      },
      supportsDocuments: true,
      documentFileTypes: ['PDF'],
      maxDocumentSizeMB: 100,
    },
  },
  tiktok: {
    icon: 'i-simple-icons-tiktok',
    color: '#000000',
    maxPostLength: 2200,
    maxImages: 35, // Photo carousel support up to 35 images
    supportsComments: true,
    supportsImagesInComments: false,
    supportsCarousel: true, // Photo carousel
    supportsVideo: true,
    maxVideoLengthSeconds: 600, // 10 minutes
    supportsLinkPreviews: false,
    supportsSounds: true,
    supportsShorts: true,
    maxConcurrentJob: 2,
    supportedFormats: ['short'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'WebP'],
      videoFileTypes: ['MP4', 'MOV'],
      maxImageSizeMB: 5,
      maxVideoSizeMB: 4096, // 4 GB
      maxVideoLengthSeconds: 600,
      aspectRatios: {
        min: 0.56, // 9:16 recommended for video
        max: 1.78, // 16:9
        recommended: ['9:16', '1:1'],
      },
      supportsDocuments: false,
    },
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
    maxVideoLengthSeconds: 300, // 5 minutes
    supportsLinkPreviews: true,
    maxConcurrentJob: 3,
    supportedFormats: ['post'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG'],
      videoFileTypes: ['MP4', 'MOV'],
      maxImageSizeMB: 8,
      maxVideoSizeMB: 512,
      maxVideoLengthSeconds: 300,
      aspectRatios: {
        min: 0.8,
        max: 1.91,
        recommended: ['1:1', '4:5', '16:9'],
      },
      supportsDocuments: false,
    },
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
    maxVideoLengthSeconds: 43200, // 12 hours
    supportsLinkPreviews: true,
    supportsTags: true,
    supportsCategories: true,
    supportsPrivacySettings: true,
    supportsShorts: true,
    maxConcurrentJob: 1,
    supportedFormats: ['post', 'short'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG'], // For thumbnails
      videoFileTypes: ['MP4', 'MOV', 'AVI', 'FLV', 'WMV'],
      maxImageSizeMB: 2,
      maxVideoSizeMB: 256000, // 256 GB
      maxVideoLengthSeconds: 43200,
      aspectRatios: {
        min: 0.56, // 9:16 for shorts
        max: 1.78, // 16:9 for regular videos
        recommended: ['16:9', '9:16'],
      },
      supportsDocuments: false,
    },
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
    maxVideoLengthSeconds: 900, // 15 minutes
    supportsLinkPreviews: true,
    maxConcurrentJob: 5,
    supportedFormats: ['post'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG'],
      videoFileTypes: ['MP4', 'MOV'],
      maxImageSizeMB: 20,
      maxVideoSizeMB: 2048, // 2 GB
      maxVideoLengthSeconds: 900,
      aspectRatios: {
        min: 0.4, // 2:5
        max: 1.91,
        recommended: ['2:3', '1:1'],
      },
      supportsDocuments: false,
    },
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
    maxVideoLengthSeconds: 300, // 5 minutes
    supportsLinkPreviews: true,
    maxConcurrentJob: 5,
    supportedFormats: ['post'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'GIF', 'WebP'],
      videoFileTypes: ['MP4', 'MOV', 'WebM'],
      maxImageSizeMB: 8,
      maxVideoSizeMB: 40,
      maxVideoLengthSeconds: 300,
      aspectRatios: {
        min: 0.5,
        max: 2.0,
        recommended: ['1:1', '16:9'],
      },
      supportsDocuments: false,
    },
  },
  bluesky: {
    icon: 'i-simple-icons-bluesky',
    color: '#0085FF',
    maxPostLength: 300,
    maxImages: 4,
    supportsComments: true,
    supportsImagesInComments: false,
    supportsCarousel: false,
    supportsVideo: true, // Now supports video
    maxVideoLengthSeconds: 60, // 60 seconds
    supportsLinkPreviews: true,
    maxConcurrentJob: 5,
    supportedFormats: ['post'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'WebP'],
      videoFileTypes: ['MP4'],
      maxImageSizeMB: 1, // 1 MB - auto-compressed by Bluesky
      maxVideoSizeMB: 50, // 50 MB
      maxVideoLengthSeconds: 60,
      aspectRatios: {
        min: 0.5,
        max: 2.0,
        recommended: ['1:1', '16:9', '9:16'],
      },
      supportsDocuments: false,
    },
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
    maxVideoLengthSeconds: 900, // 15 minutes
    supportsLinkPreviews: true,
    supportsTags: true,
    maxConcurrentJob: 1,
    supportedFormats: ['post'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'GIF'],
      videoFileTypes: ['MP4', 'MOV'],
      maxImageSizeMB: 20,
      maxVideoSizeMB: 1024, // 1 GB
      maxVideoLengthSeconds: 900,
      aspectRatios: {
        min: 0.5,
        max: 2.0,
        recommended: ['1:1', '16:9'],
      },
      supportsDocuments: false,
    },
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
    maxVideoLengthSeconds: 600, // 10 minutes
    supportsLinkPreviews: true,
    maxConcurrentJob: 5,
    supportedFormats: ['post'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'GIF', 'WebP'],
      videoFileTypes: ['MP4', 'MOV', 'WebM'],
      maxImageSizeMB: 8,
      maxVideoSizeMB: 8,
      maxVideoLengthSeconds: 600,
      aspectRatios: {
        min: 0.5,
        max: 2.0,
        recommended: ['1:1', '16:9'],
      },
      supportsDocuments: false,
    },
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
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'GIF'],
      videoFileTypes: ['MP4'],
      maxImageSizeMB: 10,
      maxVideoSizeMB: 100,
      maxVideoLengthSeconds: 60,
      aspectRatios: {
        min: 0.75,
        max: 1.33,
        recommended: ['4:3', '16:9'],
      },
      supportsDocuments: false,
    },
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
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'GIF'],
      videoFileTypes: [],
      maxImageSizeMB: 25,
      maxVideoSizeMB: 0,
      maxVideoLengthSeconds: 0,
      aspectRatios: {
        min: 0.5,
        max: 2.0,
        recommended: ['16:9', '1:1'],
      },
      supportsDocuments: false,
    },
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
    maxVideoLengthSeconds: 72000, // 20 hours
    supportsLinkPreviews: true,
    supportsTags: true,
    supportsCategories: true,
    maxConcurrentJob: 5,
    supportedFormats: ['post'],
    mediaConstraints: {
      imageFileTypes: ['JPEG', 'PNG', 'GIF', 'WebP'],
      videoFileTypes: ['MP4', 'MOV', 'AVI', 'WMV'],
      maxImageSizeMB: 10,
      maxVideoSizeMB: 1024, // 1 GB
      maxVideoLengthSeconds: 72000,
      aspectRatios: {
        min: 0.5,
        max: 2.0,
        recommended: ['16:9', '4:3', '1:1'],
      },
      supportsDocuments: false,
    },
  },
};

