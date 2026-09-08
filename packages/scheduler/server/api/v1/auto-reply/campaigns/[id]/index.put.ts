import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'
import { z } from 'zod'

const linkSchema = z.object({
  label: z.string().min(1).max(60),
  target: z.string().url().startsWith('https://'),
})

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  businessId: z.string().optional(),
  socialAccountId: z.string().min(1).optional(),
  externalPostIds: z.array(z.string().min(1)).max(20).optional(),
  matchAllPosts: z.boolean().optional(),
  keywords: z.array(z.string().min(1).max(50)).min(1).max(10).optional(),
  matchMode: z.enum(['whole', 'partial']).optional(),
  dmTemplate: z.string().min(1).max(1000).optional(),
  links: z.array(linkSchema).max(2).optional(),
  publicReplyTemplate: z.string().max(500).optional(),
  followGate: z.boolean().optional(),
  followPromptTemplate: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  mode: z.enum(['template', 'ai']).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Campaign id required' })
  const body = await readValidatedBody(event, updateSchema.parse)
  const result = await autoReplyService.updateCampaign(user.id, id, body)
  if (result.error) {
    const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'VALIDATION' ? 400 : 500
    throw createError({ statusCode: status, statusMessage: result.error })
  }
  return { success: true, data: result.data }
})
