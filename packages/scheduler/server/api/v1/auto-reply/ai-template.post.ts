import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'
import { z } from 'zod'

/**
 * Draft a DM template for the campaign form ("Generate with AI").
 *
 * Deliberately lenient on link targets: the form may call this while the user
 * is still typing a URL, so validation of `https://` stays on save, not here.
 */
const draftLinkSchema = z.object({
  label: z.string().max(60).optional().default(''),
  target: z.string().max(500).optional().default(''),
})

const generateSchema = z.object({
  keywords: z.array(z.string().min(1).max(50)).max(10).default([]),
  dmTemplate: z.string().max(1000).optional(),
  publicReplyTemplate: z.string().max(500).optional(),
  links: z.array(draftLinkSchema).max(2).default([]),
  tone: z.enum(['friendly', 'professional', 'casual']).optional(),
  businessId: z.string().optional(),
  useBusinessContext: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readValidatedBody(event, generateSchema.parse)
  const result = await autoReplyService.generateTemplate(user.id, body)
  if (result.error) {
    throw createError({ statusCode: 502, message: result.error })
  }
  return { success: true, data: result.data }
})
