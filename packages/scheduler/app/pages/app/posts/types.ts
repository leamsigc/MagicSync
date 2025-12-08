import type { PostCreateBase, Asset, PlatformContentOverride, PlatformSettingsRecord } from '#layers/BaseDB/db/schema';
import type { PlatformSettings } from '#layers/BaseScheduler/shared/platformSettings';

export interface TargetPlatform {
  accountId: string;
  platformType: string; // This will be `keyof typeof previewsMap` from NewPostModal.vue
}

export interface PostCreateBaseExtended extends Omit<PostCreateBase, 'targetPlatforms' | 'platformContent' | 'platformSettings' | 'postFormat'> {
  targetPlatforms: TargetPlatform[];
  tags?: string[];
  categories?: string[];
  privacySetting?: 'public' | 'private' | 'unlisted';
  isShort?: boolean;
  isStory?: boolean;
  hasSound?: boolean;
  platformContent?: Record<string, PlatformContentOverride>;
  platformSettings?: Record<string, PlatformSettings>;
  postFormat?: 'post' | 'reel' | 'story' | 'short';
}
