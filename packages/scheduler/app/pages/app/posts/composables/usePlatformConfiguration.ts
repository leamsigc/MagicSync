
import { useI18n } from 'vue-i18n';
import type { PostCreateBaseExtended } from '../types';
import type { Asset } from '#layers/BaseDB/db/schema';
import { platformConfigurations, type SocialMediaPlatformConfigurations } from '#layers/BaseScheduler/shared/platformConstants';
export type { PlatformConfig, SocialMediaPlatformConfigurations, PostFormat } from '#layers/BaseScheduler/shared/platformConstants';
export const usePlatformConfiguration = () => {
  const { t } = useI18n();

  function validatePostForPlatform(post: PostCreateBaseExtended, postMediaAssets: Asset[], platformType: keyof SocialMediaPlatformConfigurations): { isValid: boolean; message?: string } {
    const config = platformConfigurations[platformType];
    if (!config) {
      return { isValid: false, message: t('validation.platformConfigNotFound', { platform: platformType }) };
    }

    // Validate post content length
    if (post.content.length > config.maxPostLength) {
      return { isValid: false, message: t('validation.postTooLong', { platform: platformType, max: config.maxPostLength }) };
    }

    // Validate number of images
    if (postMediaAssets.length > config.maxImages) {
      return { isValid: false, message: t('validation.tooManyImages', { platform: platformType, max: config.maxImages }) };
    }

    // Validate video support and length
    const hasVideo = postMediaAssets.some(asset => asset.mimeType.startsWith('video/'));
    if (hasVideo) {
      if (!config.supportsVideo) {
        return { isValid: false, message: t('validation.videoNotSupported', { platform: platformType }) };
      }
      // Temporarily removing video duration validation due to missing 'durationSeconds' in Asset type.
      // A proper solution would involve extending the Asset type or parsing metadata for duration.
      // if (config.maxVideoLengthSeconds && postMediaAssets.some(asset => asset.durationSeconds && asset.durationSeconds > config.maxVideoLengthSeconds)) {
      //   return { isValid: false, message: t('validation.videoTooLong', { platform: platformType, max: config.maxVideoLengthSeconds }) };
      // }
    }

    // Validate carousel support
    if (postMediaAssets.length > 1 && !config.supportsCarousel) {
      return { isValid: false, message: t('validation.carouselNotSupported', { platform: platformType }) };
    }

    // Validate comments support
    if (post.comment && post.comment.length > 0 && !config.supportsComments) {
      return { isValid: false, message: t('validation.commentsNotSupported', { platform: platformType }) };
    }

    // Validate tags support
    if (config.supportsTags === false && post.tags && post.tags.length > 0) {
      return { isValid: false, message: t('validation.tagsNotSupported', { platform: platformType }) };
    }

    // Validate categories support
    if (config.supportsCategories === false && post.categories && post.categories.length > 0) {
      return { isValid: false, message: t('validation.categoriesNotSupported', { platform: platformType }) };
    }

    // Validate privacy settings support
    // Assuming 'public' is generally supported if privacy settings are not explicitly supported
    if (config.supportsPrivacySettings === false && post.privacySetting && post.privacySetting !== 'public') {
      return { isValid: false, message: t('validation.privacySettingsNotSupported', { platform: platformType }) };
    }

    // Validate sounds support (e.g., TikTok)
    if (config.supportsSounds === false && post.hasSound) {
      return { isValid: false, message: t('validation.soundsNotSupported', { platform: platformType }) };
    }

    // Validate shorts support (e.g., YouTube Shorts)
    if (config.supportsShorts === false && post.isShort) {
      return { isValid: false, message: t('validation.shortsNotSupported', { platform: platformType }) };
    }

    // Validate stories support (e.g., Facebook/Instagram Stories)
    if (config.supportsStories === false && post.isStory) {
      return { isValid: false, message: t('validation.storiesNotSupported', { platform: platformType }) };
    }

    return { isValid: true };
  }

  return {
    platformConfigurations,
    getPlatformConfig: (platform: keyof SocialMediaPlatformConfigurations) => {
      return platformConfigurations[platform];
    },
    validatePostForPlatform,
  };
};
