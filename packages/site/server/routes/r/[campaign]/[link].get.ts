import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'

/**
 * Public tracked-link redirect for Auto-Reply campaigns.
 * GET /r/{campaignId}/{linkId} → 302 to the campaign's https target + click count.
 * Public by design (like menu-board public slugs). Unknown ids → 404 without leaking targets.
 */
export default defineEventHandler(async (event) => {
  const campaign = getRouterParam(event, 'campaign')
  const link = getRouterParam(event, 'link')
  if (!campaign || !link) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  const result = await autoReplyService.recordClick(campaign, link)
  if (result.error || !result.data) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  return sendRedirect(event, result.data.target, 302)
})
