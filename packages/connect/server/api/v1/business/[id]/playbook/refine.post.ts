import type { H3Event } from 'h3'
import z from 'zod'
import {
  applyRefineAnswers,
  brandPlaybookService,
  getCompletion,
  mergeRefinedOverBase,
  normalizePlaybook,
  type BrandPlaybook,
} from '#layers/BaseDB/server/services/brand-playbook.service'
import { businessCorpusService } from '#layers/BaseDB/server/services/business-corpus.service'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { buildCapabilityRunContext } from '#layers/BaseAgent/server/capabilities/run-context'
import { runCapability } from '#layers/BaseAgent/server/capabilities'
import '#layers/BaseAgent/server/capabilities/playbook'

const RefineAnswerSchema = z.object({
  section: z.string().default('general'),
  group: z.string().optional(),
  question: z.string().default(''),
  answer: z.string(),
})

const RefineSchema = z.object({
  answers: z.array(RefineAnswerSchema).min(1),
  useBusinessContext: z.boolean().optional(),
})

type RefineAnswers = Array<z.infer<typeof RefineAnswerSchema>>

function pickText(res: { success: boolean, data?: unknown }): string {
  if (res.success && typeof res.data === 'string') return res.data
  return ''
}

async function resolveRefineBase(userId: string, businessId: string, event: H3Event): Promise<BrandPlaybook> {
  const baseRes = await brandPlaybookService.getRefineBase(userId, businessId, event)
  if (!baseRes.success || !baseRes.data) {
    throw createError({
      statusCode: baseRes.code === 'NOT_FOUND' ? 404 : 500,
      statusMessage: (!baseRes.success && baseRes.error) || 'Failed to load playbook base',
    })
  }
  return baseRes.data
}

async function refineWithAi(
  userId: string,
  businessId: string,
  event: H3Event,
  draft: BrandPlaybook,
  answers: RefineAnswers,
  missingFields: string[],
  businessContext: string,
): Promise<{ playbook: BrandPlaybook, aiRefined: boolean }> {
  const ctx = await buildCapabilityRunContext(userId, businessId, {
    event,
    capability: 'playbook.refine',
  })
  const outcome = await runCapability('playbook.refine', {
    draft: draft as Record<string, unknown>,
    answers,
    missingFields,
    businessContext,
  }, ctx)
  if (!outcome.ok) return { playbook: normalizePlaybook(draft), aiRefined: false }
  return { playbook: mergeRefinedOverBase(draft, outcome.output.playbook), aiRefined: true }
}

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

  const contextRes = body.useBusinessContext
    ? await businessCorpusService.getContextPrompt(id, access.data.ownerUserId)
    : { success: true as const, data: '' }
  const businessContext = pickText(contextRes)

  const base = await resolveRefineBase(user.id, id, event)
  const mergedBase = structuredClone(base)
  applyRefineAnswers(mergedBase, body.answers)
  const missingFields = getCompletion(base).missingFields

  const { playbook, aiRefined } = await refineWithAi(user.id, id, event, mergedBase, body.answers, missingFields, businessContext)
  log.info({ message: 'Playbook answers refined', businessId: id, aiRefined })
  return { playbook, aiRefined }
})
