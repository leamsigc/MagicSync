/**
 *
 * Composable Description: Real-time validation for social media posts across different platforms
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the composable
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

import { computed } from 'vue';
import type { Asset } from '#layers/BaseDB/db/schema';
import { platformConfigurations, type SocialMediaPlatformConfigurations } from '#layers/BaseScheduler/shared/platformConstants';

export type ValidationStatus = 'valid' | 'warning' | 'error';

export interface ValidationResult {
    status: ValidationStatus;
  messages: { message: string; status: ValidationStatus }[];
}

export const useValidation = () => {
    const { t } = useI18n();

    const validatePlatform = (
        platformId: keyof SocialMediaPlatformConfigurations,
        content: string,
        media: Asset[],
        comments: string[] = []
    ): ValidationResult => {
        const config = platformConfigurations[platformId];
        const messages: { message: string; status: ValidationStatus }[] = [];
        let status: ValidationStatus = 'valid';

        if (!config) {
            return {
                status: 'error',
                messages: [{ message: t('errors.unknown_platform'), status: 'error' }]
            };
        }

        // Character limit validation
        if (content.length > config.maxPostLength) {
            status = 'error';
            messages.push({
                message: `Character limit exceeded (${content.length}/${config.maxPostLength})`,
                status: 'error'
            });
        } else if (content.length > config.maxPostLength * 0.9) {
            status = 'warning';
          messages.push({
                message: `Character limit exceeded (${content.length}/${config.maxPostLength})`,
                status: 'warning'
            });
        }

        // Media requirement validation (Instagram needs media)
        if (platformId === 'instagram' && media.length === 0 && content.trim()) {
            status = 'error';
          messages.push({
                message: 'At least one image or video is required for Instagram posts.',
                status: 'error'
              });
        }

        // Media count validation
        if (media.length > config.maxImages) {
            status = 'error';
          messages.push({
                message: `Too many media items (${media.length}/${config.maxImages})`,
                status: 'error'
            });
        }

        // Video validation
        const hasVideo = media.some(asset => asset.mimeType.startsWith('video/'));
        if (hasVideo && !config.supportsVideo) {
            status = 'error';
          messages.push({
                message: 'This platform does not support video',
                status: 'error'
            });
        }

        // Carousel validation
        if (media.length > 1 && !config.supportsCarousel) {
            status = 'error';
          messages.push({
                message: 'This platform does not support carousels',
                status: 'error'
            });
        }

        // Link detection and validation
        const hasLinks = /https?:\/\/[^\s]+/.test(content);
        if (hasLinks && !config.supportsLinkPreviews) {
            if (status !== 'error') status = 'warning';
          messages.push({
                message: 'This platform does not support link previews',
                status: 'warning'
            });
        }

        // Comments validation
        if (comments.length > 0 && !config.supportsComments) {
            status = 'error';
          messages.push({
                message: 'This platform does not support comments',
                status: 'error'
            });
        }

        // Empty content validation
        if (!content.trim() && media.length === 0) {
            status = 'error';
          messages.push({
                message: 'Post content cannot be empty',
                status: 'error'
            });
        }

        // TikTok/Reels specific validation
        if ((platformId === 'tiktok' || platformId === 'instagram') && hasVideo) {
            const videoAssets = media.filter(asset => asset.mimeType.startsWith('video/'));
            if (videoAssets.length === 0) {
                if (status !== 'error') status = 'warning';
              messages.push({
                    message: 'TikTok/Reels requires a video file (MP4 + H.264).',
                    status: 'warning'
                });
            }
        }

        return {
            status,
            messages: messages.length > 0 ? messages : [{ message: 'Post is valid', status: 'valid' }],
        };
    };

    const createValidationMap = (
        platforms: Array<{ platformType: keyof SocialMediaPlatformConfigurations; accountId: string }>,
        masterContent: string,
        masterMedia: Asset[],
        masterComments: string[],
        platformOverrides: Record<string, { content?: string; comments?: string[] }>
    ) => {
        return computed(() => {
            const validationMap: Record<string, ValidationResult> = {};

            platforms.forEach(({ platformType, accountId }) => {
                const override = platformOverrides[accountId];
                const content = override?.content ?? masterContent;
                const comments = override?.comments ?? masterComments;

                validationMap[accountId] = validatePlatform(platformType, content, masterMedia, comments);
            });

            return validationMap;
        });
    };

    return {
        validatePlatform,
        createValidationMap,
    };
};
