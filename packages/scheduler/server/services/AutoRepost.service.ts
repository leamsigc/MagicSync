import { postBatchService } from '#layers/BaseDB/server/services/post-batch.service'
import { toJsonString } from '#layers/BaseShared/utils/json'
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'
import type { Post } from '#layers/BaseDB/db/schema'

export interface AutoRepostConfig {
  enabled: boolean;
  intervalHours: number;
  maxReposts: number;
  currentCount: number;
  nextRepostAt?: string;
}

export interface DueRepostItem {
  post: Post;
  config: AutoRepostConfig;
}

function isAutoRepostConfig(value: unknown): value is AutoRepostConfig {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.enabled === 'boolean'
    && typeof record.maxReposts === 'number'
    && typeof record.currentCount === 'number'
}

export class AutoRepostService {
  async getDueReposts(): Promise<ServiceResponse<DueRepostItem[]>> {
    try {
      const now = new Date();
      const result = await postBatchService.getDueReposts(now);
      if (result.error || !result.data) {
        return { success: false, error: result.error || 'Failed to fetch due reposts' }
      }
      const due: DueRepostItem[] = [];

      for (const post of result.data) {
        if (!post.autoRepost) continue;
        try {
          const parsed: unknown = JSON.parse(toJsonString(post.autoRepost, ''));
          if (!isAutoRepostConfig(parsed)) continue;
          const config = parsed;
          if (!config.enabled) continue;
          if (config.currentCount >= config.maxReposts) continue;
          if (!config.nextRepostAt) continue;
          if (new Date(config.nextRepostAt) <= now) {
            due.push({ post, config });
          }
        } catch {
          continue;
        }
      }

      return { success: true, data: due }
    } catch {
      return { success: false, error: 'Failed to fetch due reposts' }
    }
  }

  async executeRepost(item: DueRepostItem): Promise<ServiceResponse<Post>> {
    try {
      const { post, config } = item;

      const created = await postBatchService.createRepost({
        originalPostId: post.id,
        userId: post.userId,
        businessId: post.businessId,
        content: post.content,
        mediaAssets: post.mediaAssets ? JSON.parse(post.mediaAssets) : [],
        targetPlatforms: JSON.parse(post.targetPlatforms),
        platformContent: post.platformContent ? JSON.parse(post.platformContent) : undefined,
        platformSettings: post.platformSettings ? JSON.parse(post.platformSettings) : undefined,
        postFormat: post.postFormat || 'post',
        scheduledAt: new Date(config.nextRepostAt!),
        repostParentId: post.id,
      });

      if (created.error || !created.data) {
        return { success: false, error: created.error || `Failed to create repost for post ${post.id}` }
      }

      const nextCount = config.currentCount + 1;
      const nextRepostAt = new Date(
        new Date(config.nextRepostAt!).getTime() + config.intervalHours * 60 * 60 * 1000
      );

      await postBatchService.updateAutoRepostConfig(post.id, {
        ...config,
        currentCount: nextCount,
        nextRepostAt: nextRepostAt.toISOString(),
        enabled: nextCount < config.maxReposts,
      });

      await postBatchService.incrementRepostCount(post.id);

      return { success: true, data: created.data }
    } catch {
      return { success: false, error: `Failed to execute repost for post ${item.post.id}` }
    }
  }

  async processDueReposts(): Promise<ServiceResponse<{ processed: number; errors: string[] }>> {
    try {
      const dueResult = await this.getDueReposts();
      if (dueResult.error || !dueResult.data) {
        return { success: false, error: dueResult.error || 'Failed to fetch due reposts' }
      }
      const errors: string[] = [];
      let processed = 0;

      for (const item of dueResult.data) {
        const result = await this.executeRepost(item);
        if (result.success) {
          processed++;
        } else {
          errors.push(result.error || `Failed to create repost for post ${item.post.id}`);
        }
      }

      return { success: true, data: { processed, errors } }
    } catch {
      return { success: false, error: 'Failed to process due reposts' }
    }
  }
}

export const autoRepostService = new AutoRepostService();
