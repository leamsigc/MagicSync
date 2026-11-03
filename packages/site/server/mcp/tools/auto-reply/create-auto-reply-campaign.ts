import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { autoReplyService, type AutoReplyCampaign } from '#layers/BaseScheduler/server/services/AutoReply.service'
import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { autoReplyAccounts, campaignSummary } from '../../utils/auto-reply-scope'
import { FOLLOW_BUTTON_MAX_CHARS } from '#layers/BaseShared/utils/auto-reply-limits'

const linkSchema = z.object({
  label: z.string().min(1).max(40).describe('Short label, e.g. "Guide"'),
  target: z.string().url().describe('https URL the DM should send (tracked automatically)'),
})

export default defineMcpTool({
  description: 'Create an auto-reply (comment-to-DM) campaign: watch every post or specific posts, match keywords, send a DM with up to two tracked links. Requires an Instagram account connected to the key\'s business.',
  inputSchema: {
    name: z.string().min(1).max(80).describe('Campaign name'),
    socialAccountId: z.string().min(1).describe('Instagram account row id from list-auto-reply-accounts'),
    keywords: z.array(z.string().min(1).max(50)).min(1).max(10).describe('Trigger keywords, e.g. ["LINK","INFO"]'),
    dmTemplate: z.string().min(1).max(1000).describe('DM text. Use {username} and {link1}/{link2} placeholders'),
    matchMode: z.enum(['whole', 'partial']).default('whole').describe('Keyword matching mode'),
    matchAllPosts: z.boolean().optional().describe('Watch every post (default true when postIds is empty)'),
    postIds: z.array(z.string().min(1)).max(20).default([]).describe('Specific published post ids to watch (from list-auto-reply-posts)'),
    links: z.array(linkSchema).max(2).default([]).describe('Up to two tracked links'),
    publicReplyTemplate: z.string().max(500).optional().describe('Optional public comment reply text'),
    storyDmEnabled: z.boolean().default(false).describe('Also trigger on story replies and inbound DMs'),
    followGate: z.boolean().default(false).describe('Send a follow prompt with a button instead of the link until the follow is confirmed'),
    followPromptTemplate: z.string().max(500).optional().describe('Follow prompt text (uses {username})'),
    followButtonLabel: z.string().max(FOLLOW_BUTTON_MAX_CHARS).optional().describe('Follow prompt button label'),
    mode: z.enum(['template', 'ai']).default('template').describe('AI personalizes each DM from the comment'),
    enabled: z.boolean().default(true).describe('Create the campaign active'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const userId = await resolveUserId(mcp)
    const { ids } = await autoReplyAccounts(mcp)

    if (!ids.has(args.socialAccountId)) {
      throw new Error('socialAccountId is not an Instagram account connected to this business. Call list-auto-reply-accounts first.')
    }
    const matchAllPosts = args.matchAllPosts ?? args.postIds.length === 0
    if (!matchAllPosts && args.postIds.length === 0) {
      throw new Error('Pass postIds, or set matchAllPosts=true to watch every post.')
    }

    try {
      const result = await autoReplyService.createCampaign(userId, {
        platform: 'instagram',
        businessId: mcp.businessId,
        name: args.name,
        socialAccountId: args.socialAccountId,
        externalPostIds: args.postIds,
        matchAllPosts,
        keywords: args.keywords,
        matchMode: args.matchMode,
        dmTemplate: args.dmTemplate,
        linkIds: [],
        links: args.links,
        publicReplyTemplate: args.publicReplyTemplate,
        storyDmEnabled: args.storyDmEnabled,
        followGate: args.followGate,
        followPromptTemplate: args.followPromptTemplate,
        followButtonLabel: args.followButtonLabel,
        enabled: args.enabled,
        mode: args.mode,
      } as unknown as Omit<AutoReplyCampaign, 'id' | 'userId' | 'createdAt' | 'updatedAt'>)
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to create the campaign')

      await logMcpCall(mcp, 'create-auto-reply-campaign', result.data.id)
      return { businessId: mcp.businessId, campaign: campaignSummary(result.data) }
    }
    catch (error) {
      await logMcpCall(mcp, 'create-auto-reply-campaign', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})
