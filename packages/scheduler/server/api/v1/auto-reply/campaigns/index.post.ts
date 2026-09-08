import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'
import { z } from 'zod'

const linkSchema = z.object({
  label: z.string().min(1).max(60),
  target: z.string().url().startsWith('https://'),
})

const createSchema = z.object({
  name: z.string().min(1).max(80),
  businessId: z.string().optional(),
  socialAccountId: z.string().min(1),
  externalPostIds: z.array(z.string().min(1)).max(20).default([]),
  matchAllPosts: z.boolean().optional(),
  keywords: z.array(z.string().min(1).max(50)).min(1).max(10),
  matchMode: z.enum(['whole', 'partial']).default('whole'),
  dmTemplate: z.string().min(1).max(1000),
  links: z.array(linkSchema).max(2).default([]),
  publicReplyTemplate: z.string().max(500).optional(),
  storyDmEnabled: z.boolean().default(false),
  followGate: z.boolean().default(false),
  followPromptTemplate: z.string().max(500).optional(),
  enabled: z.boolean().default(true),
  mode: z.enum(['template', 'ai']).default('template'),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readValidatedBody(event, createSchema.parse)
  const result = await autoReplyService.createCampaign(user.id, body)
  if (result.error) {
    const status = result.code === 'VALIDATION' ? 400 : 500
    throw createError({ statusCode: status, statusMessage: result.error })
  }
  return { success: true, data: result.data }
})
