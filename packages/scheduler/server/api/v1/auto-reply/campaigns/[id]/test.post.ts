import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'
import { z } from 'zod'

const testSchema = z.object({
  text: z.string().min(1).max(1000),
  keywords: z.array(z.string().min(1).max(50)).min(1).max(10).optional(),
  matchMode: z.enum(['whole', 'partial']).default('whole'),
  campaignId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  const body = await readValidatedBody(event, testSchema.parse)
  if (body.campaignId || id) {
    const targetId = body.campaignId || id
    if (targetId) {
      const campaign = await autoReplyService.getCampaign(user.id, targetId)
      if (!campaign.error && campaign.data) {
        const matched = autoReplyService.testMatch(body.text, campaign.data.keywords, campaign.data.matchMode)
        return { success: true, data: matched.data }
      }
    }
  }
  const matched = autoReplyService.testMatch(body.text, body.keywords || [], body.matchMode)
  return { success: true, data: matched.data }
})
