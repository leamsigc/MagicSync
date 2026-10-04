import { z } from 'zod'
import type { H3Event } from 'h3'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
// Import the capability AGGREGATOR, never `capabilities/registry` directly:
// only the aggregator runs `import './content'`, so importing the bare
// registry module leaves the registry empty and every call fails with
// CAPABILITY_UNKNOWN (see content-api-registration.test.mjs).
//
// The explicit `registerContentCapabilities()` call is ALSO required, not
// redundant. Capabilities are registered as an import side effect, but the
// layer resolves this file relatively (`../capabilities`) while
// `api/v1/agent/goals/index.post.ts` resolves the same directory through the
// `#layers/BaseAgent/server/...` alias. When those produce two module
// instances, bundler dedup evaluates `import './content'` only in the first
// one, so this instance's registry stays empty and the route 422s with
// CAPABILITY_UNKNOWN. Registration is idempotent, so calling it here
// guarantees the registry this module dispatches against is populated.
import { registerContentCapabilities } from '../capabilities/content'
import { buildCapabilityRunContext, runCapability, type CapabilityOutcome } from '../capabilities'

registerContentCapabilities()

const BusinessBodySchema = z.object({ businessId: z.string().min(1) }).passthrough()

export async function runContentApi<Output>(event: H3Event, capabilityId: string): Promise<Output> {
  const user = await checkUserIsLogin(event)
  const body = BusinessBodySchema.parse(await readBody(event))
  const access = await requireBusinessAccess(event, user.id, body.businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }
  const context = await buildCapabilityRunContext(user.id, body.businessId, {
    useBusinessContext: true,
    event,
    log: useLogger(event),
    capability: capabilityId,
  })
  const outcome = await runCapability(capabilityId, body, context) as CapabilityOutcome<Output>
  if (!outcome.ok) {
    throw createError({
      statusCode: outcome.code === 'VALIDATION_ERROR' ? 400 : outcome.code === 'CONFIRMATION_REQUIRED' ? 409 : 422,
      statusMessage: outcome.error,
      data: { code: outcome.code },
    })
  }
  return outcome.output
}
