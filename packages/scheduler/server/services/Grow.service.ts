import type { Account } from '#layers/BaseDB/db/schema';
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { SchedulerPost } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import type { PluginSocialMediaAccount } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { BlueskyPlugin } from '#layers/BaseScheduler/server/services/plugins/bluesky.plugin';

export interface GrowRecommendation {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  followersCount?: number;
  reason: 'follow-back' | 'suggested';
  score: number;
}

export interface GrowRecommendations {
  platform: string;
  accountId: string;
  recommendations: GrowRecommendation[];
}

/**
 * Grow service — follow recommendations for Bluesky (OpenPost parity, Gap 4).
 *
 * Read-only discovery + explicit manual follow. Nothing here ever follows
 * anyone automatically: `followAccount` is only reachable from the user's
 * explicit Follow button press.
 */
export class GrowService {
  private growCapablePlatforms = new Set(['bluesky']);

  supportsGrow(platform: string) {
    return this.growCapablePlatforms.has(platform);
  }

  private async resolveAccount(accountId: string, userId: string) {
    const account = await socialMediaAccountService.getAccountById(accountId, userId);
    if (!account) {
      return { error: 'Social media account not found' as const };
    }
    if (!this.supportsGrow(account.platform)) {
      return { error: 'Grow recommendations are not supported for this platform yet' as const };
    }
    return { account };
  }

  private blueskyPlugin(account: Account) {
    const scheduler = new SchedulerPost({ accounts: [account] });
    scheduler.use(BlueskyPlugin);
    const plugin = scheduler.getPlugin('bluesky');
    if (!plugin) throw new Error('Bluesky plugin not registered');
    return plugin as unknown as BlueskyPlugin;
  }

  async getRecommendations({
    accountId,
    userId,
    limit = 25,
  }: {
    accountId: string;
    userId: string;
    limit?: number;
  }): Promise<GrowRecommendations> {
    const resolved = await this.resolveAccount(accountId, userId);
    if ('error' in resolved) throw new Error(resolved.error);
    const { account } = resolved;

    const plugin = this.blueskyPlugin(account);
    const pluginAccount = account as unknown as PluginSocialMediaAccount;
    const capped = Math.min(Math.max(limit, 1), 50);

    const [followbacks, suggested] = await Promise.all([
      plugin.getGrowFollowbacks(pluginAccount, { limit: capped }),
      plugin.getGrowSuggestions(pluginAccount, { limit: capped }),
    ]);

    const seen = new Set<string>();
    const recommendations: GrowRecommendation[] = [];
    for (const f of followbacks) {
      if (seen.has(f.did)) continue;
      seen.add(f.did);
      recommendations.push({ ...f, reason: 'follow-back', score: 90 });
    }
    for (const s of suggested) {
      if (seen.has(s.did)) continue;
      seen.add(s.did);
      const bonus = (s.followersCount ?? 0) > 1000 ? 10 : 0;
      recommendations.push({ ...s, reason: 'suggested', score: 50 + bonus });
    }
    recommendations.sort((a, b) => b.score - a.score);

    return {
      platform: account.platform,
      accountId: account.id,
      recommendations: recommendations.slice(0, capped),
    };
  }

  async followAccount({
    accountId,
    userId,
    did,
  }: {
    accountId: string;
    userId: string;
    did: string;
  }): Promise<{ success: boolean; uri?: string; error?: string }> {
    const resolved = await this.resolveAccount(accountId, userId);
    if ('error' in resolved) throw new Error(resolved.error);
    const { account } = resolved;

    const plugin = this.blueskyPlugin(account);
    return plugin.followAccount(account as unknown as PluginSocialMediaAccount, did);
  }
}

export const growService = new GrowService();
