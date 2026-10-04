import { z } from 'zod'
import { capabilityRegistry, type Capability, type CapabilityRunContext } from './registry'
import { renderPrompt } from '../agent/prompts'
import { extractJsonObject } from '../utils/run-config'

/**
 * T20 `workflow.idea_scan` — the trend-scan idea generation step's declared
 * capability. Prompt (`idea-scan.md`) and output contract moved from
 * `agent-workflow.service.ts`; the service keeps board writes and run rows.
 */

const IdeaScanInputSchema = z.object({
  count: z.number().int().min(10).max(20).default(15),
  system: z.string().max(20000).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
})

const IdeaScanOutputSchema = z.object({
  ideas: z.array(z.object({
    title: z.string().min(1).max(140),
    brief: z.string().max(500).default(''),
    platforms: z.array(z.string().min(1).max(40)).max(12).default([]),
  })).min(10).max(20),
})

async function runIdeaScan(rawInput: unknown, ctx: CapabilityRunContext) {
  const parsed = IdeaScanInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false as const, error: 'Idea count must be between 10 and 20', code: 'VALIDATION_ERROR' }
  }
  const count = Math.min(Math.max(parsed.data.count, 10), 20)
  const text = await ctx.complete({
    system: parsed.data.system,
    prompt: renderPrompt('ideaScan', { count: String(count) }),
    maxTokens: parsed.data.maxTokens ?? 2400,
  })
  const validated = IdeaScanOutputSchema.safeParse(extractJsonObject(text))
  if (!validated.success) {
    return { success: false as const, error: 'AI idea scan returned no usable ideas', code: 'AI_PARSE_FAILED' }
  }
  return { success: true as const, data: validated.data }
}

const workflowIdeaScanCapability: Capability = {
  id: 'workflow.idea_scan',
  title: 'Scan for ideas',
  description: 'Propose trend-angled content ideas for the business.',
  agent: (input: unknown, ctx: CapabilityRunContext) => runIdeaScan(input, ctx),
  inputSchema: IdeaScanInputSchema,
  outputSchema: IdeaScanOutputSchema,
  consequential: false,
  stream: 'none',
  render: 'ideas',
}

export function registerWorkflowCapabilities(): void {
  if (!capabilityRegistry.has(workflowIdeaScanCapability.id)) capabilityRegistry.register(workflowIdeaScanCapability)
}

registerWorkflowCapabilities()

export { workflowIdeaScanCapability }
