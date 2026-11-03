import type { ApiKeyContext } from '#layers/BaseAuth/server/services/api-key.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { autoReplyService, type AutoReplyCampaign } from '#layers/BaseScheduler/server/services/AutoReply.service'

export async function autoReplyAccounts(mcp: ApiKeyContext) {
  const accounts = await socialMediaAccountService.getAccountsByBusinessIdWithOutActiveCheck(mcp.businessId)
  const instagram = accounts.filter(account => account.platform === 'instagram')
  return {
    all: accounts,
    instagram,
    ids: new Set(instagram.map(account => account.id)),
  }
}

export function campaignSummary(campaign: AutoReplyCampaign) {
  return {
    id: campaign.id,
    name: campaign.name,
    enabled: campaign.enabled,
    socialAccountId: campaign.socialAccountId,
    keywords: campaign.keywords,
    matchMode: campaign.matchMode,
    matchAllPosts: campaign.matchAllPosts ?? false,
    postIds: campaign.externalPostIds,
    dmTemplate: campaign.dmTemplate,
    links: (campaign.links ?? []).map(link => ({ label: link.label, target: link.target, clicks: link.clicks })),
    storyDmEnabled: campaign.storyDmEnabled ?? false,
    followGate: campaign.followGate,
    followPromptTemplate: campaign.followPromptTemplate ?? null,
    followButtonLabel: campaign.followButtonLabel ?? null,
    mode: campaign.mode ?? 'template',
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  }
}

export async function requireCampaign(mcp: ApiKeyContext, userId: string, campaignId: string) {
  const { ids } = await autoReplyAccounts(mcp)
  const result = await autoReplyService.getCampaign(userId, campaignId)
  if (!result.success || !result.data) {
    throw new Error(`Auto-reply campaign "${campaignId}" was not found.`)
  }
  if (!ids.has(result.data.socialAccountId)) {
    throw new Error(`Auto-reply campaign "${campaignId}" belongs to another business.`)
  }
  return result.data
}
