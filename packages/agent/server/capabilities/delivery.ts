import { z } from 'zod'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'
import { capabilityRegistry, type Capability, type CapabilityRunContext } from './registry'

/**
 * T12 `delivery.schedule` — the first consequential capability (PRD §11):
 * scheduling is an external mutation and never executes without an explicit
 * approval transition. `runCapability` enforces the gate; this agent only
 * runs with a verified grant and delegates the domain checks (approved
 * artifact, targets) to the existing service.
 */

const ScheduleInputSchema = z.object({
  artifactId: z.string().min(1),
  scheduledAt: z.string().datetime({ offset: true }),
  targetAccountIds: z.array(z.string().min(1)).optional(),
})

const ScheduleOutputSchema = z.object({
  scheduled: z.boolean(),
  scheduledAt: z.string(),
  postId: z.string().nullable(),
})

async function runSchedule(rawInput: unknown, ctx: CapabilityRunContext) {
  const parsed = ScheduleInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false as const, error: 'A valid artifact and schedule time are required', code: 'VALIDATION_ERROR' }
  }
  const scheduled = await contentArtifactService.scheduleArtifact(
    ctx.userId,
    parsed.data.artifactId,
    ctx.businessId,
    new Date(parsed.data.scheduledAt),
    ctx.event,
    parsed.data.targetAccountIds,
  )
  if (!scheduled.success) return { success: false as const, error: scheduled.error, code: scheduled.code ?? 'SCHEDULE_FAILED' }
  return {
    success: true as const,
    data: {
      scheduled: true,
      scheduledAt: parsed.data.scheduledAt,
      postId: scheduled.data.postId,
    },
  }
}

const deliveryScheduleCapability: Capability = {
  id: 'delivery.schedule',
  title: 'Schedule the post',
  description: 'Schedule an approved post for its accounts. Needs your approval first.',
  agent: (input: unknown, ctx: CapabilityRunContext) => runSchedule(input, ctx),
  inputSchema: ScheduleInputSchema,
  outputSchema: ScheduleOutputSchema,
  consequential: true,
  stream: 'none',
  render: 'delivery',
}

export function registerDeliveryCapabilities(): void {
  if (!capabilityRegistry.has(deliveryScheduleCapability.id)) capabilityRegistry.register(deliveryScheduleCapability)
}

registerDeliveryCapabilities()

export { deliveryScheduleCapability }
