import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { FOLLOW_BUTTON_MAX_CHARS } from '#layers/BaseShared/utils/auto-reply-limits'
import type { AgentToolContext } from '../tool-context'
import { appApi } from './app-api'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'AUTOREPLY_ERROR')

/**
 * Auto-reply campaigns are scheduler-owned. The agent layer cannot import that
 * layer (`connect` depends on `agent`, so the workspace graph would cycle), so
 * these tools go through the app's own API with the chat request's cookies.
 */
interface Campaign {
  id: string
  name: string
  enabled: boolean
  socialAccountId: string
  keywords: string[]
  matchMode: 'whole' | 'partial'
  matchAllPosts?: boolean
  externalPostIds: string[]
  dmTemplate: string
  links?: Array<{ label: string, target: string, clicks: number }>
  storyDmEnabled?: boolean
  followGate: boolean
  mode?: 'template' | 'ai'
}

async function replyApi<T>(
  ctx: AgentToolContext,
  path: string,
  options: { method?: 'GET' | 'POST', body?: unknown } = {},
): Promise<T> {
  const response = await appApi<{ data?: T }>(ctx, path, {
    method: options.method ?? 'GET',
    body: options.body,
  })
  return response.data as T
}

async function autoReplyAccountIds(ctx: AgentToolContext): Promise<Set<string>> {
  const accounts = await socialMediaAccountService.getAccountsByBusinessIdWithOutActiveCheck(ctx.businessId)
  return new Set(accounts.filter(account => account.platform === 'instagram').map(account => account.id))
}

async function ownedCampaigns(ctx: AgentToolContext): Promise<Campaign[]> {
  const ids = await autoReplyAccountIds(ctx)
  const campaigns = await replyApi<Campaign[]>(ctx, `/api/v1/auto-reply/campaigns?businessId=${encodeURIComponent(ctx.businessId)}`)
  return campaigns.filter(campaign => ids.has(campaign.socialAccountId))
}

function campaignShape(campaign: Campaign) {
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

function campaignCounts(campaigns: Campaign[]) {
  return {
    all: campaigns.length,
    active: campaigns.filter(campaign => campaign.enabled).length,
    inactive: campaigns.filter(campaign => !campaign.enabled).length,
  }
}

async function campaignDetail(
  ctx: AgentToolContext,
  business: Awaited<ReturnType<typeof businessProfileService.findByIdOnly>>,
  campaigns: Campaign[],
  campaignId: string,
) {
  const campaign = campaigns.find(entry => entry.id === campaignId)
  if (!campaign) toolError('NOT_FOUND', 'Auto-reply campaign not found for this business')
  const stats = await replyApi<unknown>(ctx, `/api/v1/auto-reply/campaigns/${campaignId}/stats`)
  const logs = await replyApi<unknown[]>(ctx, `/api/v1/auto-reply/campaigns/${campaignId}/logs?limit=10`)
  return toolResult({ business: businessRef(business), campaign: campaignShape(campaign), stats, logs })
}

async function campaignList(
  ctx: AgentToolContext,
  business: Awaited<ReturnType<typeof businessProfileService.findByIdOnly>>,
  campaigns: Campaign[],
  instagram: Array<{ id: string, accountName: string, accountId: string, isActive: boolean }>,
) {
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
  })
}

async function overview(ctx: AgentToolContext, input: { campaignId?: string }) {
  const business = await businessProfileService.findByIdOnly(ctx.businessId)
  const accounts = await socialMediaAccountService.getAccountsByBusinessIdWithOutActiveCheck(ctx.businessId)
  const instagram = accounts.filter(account => account.platform === 'instagram')
  const campaigns = await ownedCampaigns(ctx)
  if (input.campaignId) return campaignDetail(ctx, business, campaigns, input.campaignId)
  return campaignList(ctx, business, campaigns, instagram)
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
  const campaign = await replyApi<Campaign>(ctx, '/api/v1/auto-reply/campaigns', {
    method: 'POST',
    body: {
      businessId: ctx.businessId,
      name: input.name,
      socialAccountId: input.socialAccountId,
      externalPostIds: postIds,
      matchAllPosts,
      keywords: input.keywords,
      matchMode: input.matchMode ?? 'whole',
      dmTemplate: input.dmTemplate,
      links: input.links,
      storyDmEnabled: input.storyDmEnabled ?? false,
      followGate: input.followGate ?? false,
      followPromptTemplate: input.followPromptTemplate,
      followButtonLabel: input.followButtonLabel,
      enabled: input.enabled ?? true,
      mode: input.mode ?? 'template',
    },
  })
  return toolResult({ campaign: campaignShape(campaign) })
}

export function createAutoReplyTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'auto_reply_overview',
      description: 'List the business\'s Instagram accounts and auto-reply campaigns (active and inactive), or one campaign with stats and logs.',
      input: v.object({
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
