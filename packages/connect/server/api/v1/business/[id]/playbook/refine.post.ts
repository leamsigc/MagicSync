import { brandPlaybookService } from '#layers/BaseDB/server/services/brand-playbook.service';
import { businessCorpusService } from '#layers/BaseDB/server/services/business-corpus.service';
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access';
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import { createLlmJwt } from '#layers/BaseDB/server/utils/llm-jwt'
import { AI_KEY_MESSAGE, isAuthFailure } from '#layers/BaseDB/server/utils/ai-error'
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import z from 'zod';

function pickText(res: { success: boolean, data?: unknown }): string {
  if (res.success && typeof res.data === 'string') {
    return res.data
  }
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
  if (res.success && res.data && typeof res.data.playbook === 'object') {
    return res.data.playbook
  }
  return null
}

const RefineSchema = z.object({
  answers: z.array(z.object({
    section: z.string().default('general'),
    question: z.string().default(''),
    answer: z.string(),
  })).min(1),
  useBusinessContext: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const id = getRouterParam(event, 'id');
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Business ID is required' })
    }

    const body = await readValidatedBody(event, RefineSchema.parse);
    log.set({ userId: user.id, businessId: id })

    const access = await requireBusinessAccess(event, user.id, id);
    if (!access.success || !access.data) {
      throw createError({
        statusCode: accessErrorStatus(access.code),
        statusMessage: access.error || 'Business not found'
      });
    }
    const ownerId = access.data.ownerUserId;
    const [draftRes, contextRes] = await Promise.all([
      brandPlaybookService.getCurrent(user.id, id, event),
      body.useBusinessContext
        ? businessCorpusService.getContextPrompt(id, ownerId)
        : Promise.resolve({ success: true as const, data: '' }),
    ])
    assertOwnsBusiness(draftRes)
    const draft = pickPlaybook(draftRes)
    const businessContext = pickText(contextRes)

    const llmConfig = await userLlmConfigService.getEffectiveConfig(user.id, id)
    const llmJwt = createLlmJwt(user.id, user.email || '', llmConfig.data ?? null)

    const config = useRuntimeConfig()
    const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/api/v1/research/refine-playbook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmJwt}`,
      },
      body: JSON.stringify({
        answers: body.answers,
        draft,
        business_context: businessContext,
      }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      log.error({ content: 'Refine playbook failed', status: response.status })
      if (isAuthFailure(detail)) {
        throw createError({ statusCode: 400, statusMessage: AI_KEY_MESSAGE })
      }
      throw createError({ statusCode: 502, statusMessage: detail.slice(0, 300) || 'AI refinement failed' })
    }

    const refined = await response.json()
    log.info({ message: 'Playbook answers refined', businessId: id })
    return refined
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    log.error({ content: 'Refine playbook error', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
