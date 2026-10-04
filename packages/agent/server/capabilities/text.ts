import { z } from 'zod'
import type { H3Event } from 'h3'
import type { CapabilityRunContext } from './registry'
import { capabilityRegistry, runCapability } from './registry'
import { extractJsonObject } from '../utils/run-config'

/**
 * T20: `text.generate` — the one capability replacing the deleted raw
 * prompt-to-text escape hatch (PRD §3.7, locked decision 17).
 * Feature endpoints (MCP AI tools, social generation, text-to-SQL, playbook
 * refine, workflow steps, pipeline model nodes) pass their prompt + system
 * context; the capability runs the caller's effective model and returns
 * validated { text, json }. Model calls stay attributed and logged.
 */

const TextInputSchema = z.object({
  prompt: z.string().min(1),
  system: z.string().max(20000).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
})

const TextOutputSchema = z.object({
  text: z.string(),
  json: z.record(z.string(), z.unknown()).nullable(),
})

export type TextGenerateInput = z.infer<typeof TextInputSchema>
export type TextGenerateOutput = z.infer<typeof TextOutputSchema>

async function runTextGenerate(rawInput: unknown, ctx: CapabilityRunContext) {
  const input = TextInputSchema.parse(rawInput)
  const text = await ctx.complete({
    system: input.system,
    prompt: input.prompt,
    maxTokens: input.maxTokens ?? 1600,
  })
  return {
    success: true as const,
    data: { text, json: extractJsonObject(text) },
  }
}

const textGenerateCapability = {
  id: 'text.generate',
  title: 'Generate text',
  description: 'Run a structured text generation on the effective model.',
  agent: (input: unknown, ctx: CapabilityRunContext) => runTextGenerate(input, ctx),
  inputSchema: TextInputSchema,
  outputSchema: TextOutputSchema,
  consequential: false,
  stream: 'none' as const,
  render: 'text' as const,
}

export function registerTextGenerateCapability(): void {
  if (!capabilityRegistry.has(textGenerateCapability.id)) capabilityRegistry.register(textGenerateCapability)
}

registerTextGenerateCapability()

export { textGenerateCapability }
