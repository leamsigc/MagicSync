import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import type { AutoReplyCampaign } from '#layers/BaseScheduler/server/services/AutoReply.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import type { AgentToolContext } from '../tool-context'
import { FOLLOW_BUTTON_MAX_CHARS } from '#layers/BaseShared/utils/auto-reply-limits'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'AUTOREPLY_ERROR')

async function replyService() {
  const mod = await import('#layers/BaseScheduler/server/services/AutoReply.service')
  return mod.autoReplyService
}

async function autoReplyAccountIds(ctx: AgentToolContext): Promise<Set<string>> {
  const accounts = await socialMediaAccountService.getAccountsByBusinessIdWithOutActiveCheck(ctx.businessId)
  return new Set(accounts.filter(account => account.platform === 'instagram').map(account => account.id))
}

async function ownedCampaigns(ctx: AgentToolContext): Promise<AutoReplyCampaign[]> {
  const ids = await autoReplyAccountIds(ctx)
  const service = await replyService()
  const result = await service.listCampaigns(ctx.userId)
  if (!result.success) toolError(result.code, result.error || 'Failed to list auto-reply campaigns')
  return (result.data ?? []).filter(campaign => ids.has(campaign.socialAccountId))
}

function campaignShape(campaign: AutoReplyCampaign) {
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
    mode: campaign.mode ?? 'template',
  }
}

function businessRef(business: Awaited<ReturnType<typeof businessProfileService.findByIdOnly>>) {
  return business.success ? { id: business.data.id, name: business.data.name } : null
}

function campaignCounts(campaigns: AutoReplyCampaign[]) {
  return {
    all: campaigns.length,
    active: campaigns.filter(campaign => campaign.enabled).length,
    inactive: campaigns.filter(campaign => !campaign.enabled).length,
  }
}

async function campaignDetail(
  ctx: AgentToolContext,
  business: Awaited<ReturnType<typeof businessProfileService.findByIdOnly>>,
  campaigns: AutoReplyCampaign[],
  campaignId: string,
) {
  const campaign = campaigns.find(entry => entry.id === campaignId)
  if (!campaign) toolError('NOT_FOUND', 'Auto-reply campaign not found for this business')
  const service = await replyService()
  const stats = await service.getStats(ctx.userId, campaign.id)
  if (!stats.success) toolError(stats.code, stats.error)
  const logs = await service.getLogs(ctx.userId, campaign.id, 10)
  return toolResult({
    business: businessRef(business),
    campaign: campaignShape(campaign),
    stats: stats.data,
    logs: logs.success ? logs.data : [],
  })
}

async function campaignList(
  ctx: AgentToolContext,
  business: Awaited<ReturnType<typeof businessProfileService.findByIdOnly>>,
  campaigns: AutoReplyCampaign[],
  instagram: Array<{ id: string, accountName: string, accountId: string, isActive: boolean }>,
  socialAccountId: string | undefined,
) {
  const posts = socialAccountId
    ? await (await replyService()).listPublishedPosts(ctx.userId, socialAccountId, 10)
    : null
  return toolResult({
    business: businessRef(business),
    instagramAccounts: instagram.map(account => ({
      id: account.id,
      accountName: account.accountName,
      accountId: account.accountId,
      isActive: account.isActive,
    })),
    counts: campaignCounts(campaigns),
    campaigns: campaigns.map(campaignShape),
    posts: posts?.success ? posts.data : [],
  })
}

async function overview(ctx: AgentToolContext, input: { socialAccountId?: string, campaignId?: string }) {
  const business = await businessProfileService.findByIdOnly(ctx.businessId)
  const accounts = await socialMediaAccountService.getAccountsByBusinessIdWithOutActiveCheck(ctx.businessId)
  const instagram = accounts.filter(account => account.platform === 'instagram')
  const ids = new Set(instagram.map(account => account.id))
  if (input.socialAccountId && !ids.has(input.socialAccountId)) {
    toolError('NOT_FOUND', 'That Instagram account is not connected to this business')
  }
  const campaigns = await ownedCampaigns(ctx)
  if (input.campaignId) {
    return campaignDetail(ctx, business, campaigns, input.campaignId)
  }
  return campaignList(ctx, business, campaigns, instagram, input.socialAccountId)
}

async function createCampaign(ctx: AgentToolContext, input: {
  name: string
  socialAccountId: string
  keywords: string[]
  dmTemplate: string
  links: Array<{ label: string, target: string }>
  matchAllPosts?: boolean
  postIds?: string[]
  matchMode?: 'whole' | 'partial'
  publicReplyTemplate?: string
  storyDmEnabled?: boolean
  followGate?: boolean
  followPromptTemplate?: string
  followButtonLabel?: string
  mode?: 'template' | 'ai'
  enabled?: boolean
}) {
  const ids = await autoReplyAccountIds(ctx)
  if (!ids.has(input.socialAccountId)) {
    toolError('NOT_FOUND', 'That Instagram account is not connected to this business')
  }
  const postIds = input.postIds ?? []
  const matchAllPosts = input.matchAllPosts ?? postIds.length === 0
  if (!matchAllPosts && postIds.length === 0) {
    toolError('VALIDATION_ERROR', 'Pass postIds, or set matchAllPosts=true to watch every post')
  }
  const service = await replyService()
  const result = await service.createCampaign(ctx.userId, {
    platform: 'instagram',
    businessId: ctx.businessId,
    name: input.name,
    socialAccountId: input.socialAccountId,
    externalPostIds: postIds,
    matchAllPosts,
    keywords: input.keywords,
    matchMode: input.matchMode ?? 'whole',
    dmTemplate: input.dmTemplate,
    linkIds: [],
    links: input.links,
    publicReplyTemplate: input.publicReplyTemplate,
    storyDmEnabled: input.storyDmEnabled ?? false,
    followGate: input.followGate ?? false,
    followPromptTemplate: input.followPromptTemplate,
    followButtonLabel: input.followButtonLabel,
    enabled: input.enabled ?? true,
    mode: input.mode ?? 'template',
  } as Omit<AutoReplyCampaign, 'id' | 'userId' | 'createdAt' | 'updatedAt'>)
  if (!result.success || !result.data) toolError(result.code, result.error || 'Failed to create the campaign')
  return toolResult({ campaign: campaignShape(result.data) })
}

export function createAutoReplyTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'auto_reply_overview',
      description: 'List the business\'s Instagram accounts, auto-reply campaigns (active and inactive), and optionally recent posts or one campaign with stats and logs.',
      input: v.object({
        socialAccountId: v.optional(v.pipe(v.string(), v.description('Instagram account id to list recent posts for'))),
        campaignId: v.optional(v.pipe(v.string(), v.description('Campaign id to load details, stats and logs for'))),
      }),
      run: async toolCtx => overview(ctx, toolCtx.data),
    }),
    defineTool({
      name: 'create_auto_reply_campaign',
      description: 'Create a comment-to-DM auto-reply campaign for the business: watch every post or specific post ids, match keywords, send a DM with tracked links.',
      input: v.object({
        name: v.pipe(v.string(), v.description('Campaign name')),
        socialAccountId: v.pipe(v.string(), v.description('Instagram account id from auto_reply_overview')),
        keywords: v.pipe(v.array(v.string()), v.description('Trigger keywords')),
        dmTemplate: v.pipe(v.string(), v.description('DM text with {username} and {link1} placeholders')),
        links: v.optional(v.pipe(v.array(v.object({
          label: v.pipe(v.string(), v.description('Short label')),
          target: v.pipe(v.string(), v.description('https URL')),
        })), v.description('Up to two tracked links'))),
        matchAllPosts: v.optional(v.pipe(v.boolean(), v.description('Watch every post (default when postIds is empty)'))),
        postIds: v.optional(v.pipe(v.array(v.string()), v.description('Specific published post ids'))),
        matchMode: v.optional(v.picklist(['whole', 'partial'])),
        storyDmEnabled: v.optional(v.boolean()),
        followGate: v.optional(v.boolean()),
        followPromptTemplate: v.optional(v.string()),
        followButtonLabel: v.optional(v.pipe(v.string(), v.maxLength(FOLLOW_BUTTON_MAX_CHARS))),
        mode: v.optional(v.picklist(['template', 'ai'])),
        enabled: v.optional(v.boolean()),
      }),
      run: async toolCtx => createCampaign(ctx, {
        ...toolCtx.data,
        links: toolCtx.data.links ?? [],
      }),
    }),
  ]
}
