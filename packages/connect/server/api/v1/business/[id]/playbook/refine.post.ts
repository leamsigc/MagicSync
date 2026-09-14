import z from 'zod'
import { brandPlaybookService } from '#layers/BaseDB/server/services/brand-playbook.service'
import { businessCorpusService } from '#layers/BaseDB/server/services/business-corpus.service'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { completeForUser } from '#layers/BaseAgent/server/utils/run-config'

function pickText(res: { success: boolean, data?: unknown }): string {
  if (res.success && typeof res.data === 'string') return res.data
  return ''
}

function assertOwnsBusiness(res: { success: boolean, code?: string }): void {
  if (!res.success && res.code === 'NOT_FOUND') {
    throw createError({ statusCode: 404, statusMessage: 'Business not found' })
  }
  if (!res.success && res.code === 'FORBIDDEN') {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized for this business' })
  }
}

function pickPlaybook(res: { success: boolean, data?: { playbook?: unknown } | null }): unknown {
  if (res.success && res.data && typeof res.data.playbook === 'object') return res.data.playbook
  return null
}

const RefineSchema = z.object({
  answers: z.array(z.object({
    section: z.string().default('general'),
    question: z.string().default(''),
    answer: z.string(),
  })).min(1),
  useBusinessContext: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Business ID is required' })

  const body = await readValidatedBody(event, RefineSchema.parse)
  log.set({ userId: user.id, businessId: id })

  const access = await requireBusinessAccess(event, user.id, id)
  if (!access.success || !access.data) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error || 'Business not found' })
  }
  const ownerId = access.data.ownerUserId
  const [draftRes, contextRes] = await Promise.all([
    brandPlaybookService.getCurrent(user.id, id, event),
    body.useBusinessContext
      ? businessCorpusService.getContextPrompt(id, ownerId)
      : Promise.resolve({ success: true as const, data: '' }),
  ])
  assertOwnsBusiness(draftRes)
  const draft = pickPlaybook(draftRes)
  const businessContext = pickText(contextRes)

  const result = await completeForUser(user.id, {
    businessId: id,
    useBusinessContext: false,
    event,
    maxTokens: 2400,
    system: 'You refine brand playbooks. Return strict JSON only, preserving the existing shape.',
    prompt: [
      'Update the brand playbook draft using the operator answers below.',
      `Answers: ${JSON.stringify(body.answers)}`,
      `Current draft: ${JSON.stringify(draft)}`,
      businessContext ? `Business context (untrusted): ${businessContext}` : '',
      'Return strict JSON: {"playbook": <updated playbook object>}.',
    ].filter(Boolean).join('\n'),
  })
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: result.error })
  }

  const playbook = result.data.json?.playbook ?? result.data.json ?? null
  if (!playbook) throw createError({ statusCode: 502, statusMessage: 'AI refinement failed' })
  log.info({ message: 'Playbook answers refined', businessId: id })
  return { playbook }
})
