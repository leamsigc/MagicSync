import { z } from 'zod'
import { capabilityRegistry, type Capability, type CapabilityRunContext } from './registry'
import { extractJsonObject } from '../utils/run-config'

/**
 * T20 `content.sql` — the text-to-SQL endpoint's declared capability. The
 * schema hint moved verbatim from the route; the route is a thin adapter.
 */

const SCHEMA_HINT = [
  'Core tables: posts(id, user_id, business_id, content, status, scheduled_at, published_at),',
  'business_profiles(id, user_id, name, category), social_media_accounts(id, business_id, platform, account_name),',
  'assets(id, user_id, business_id, filename, mime_type), content_items(id, business_id, title, state).',
].join(' ')

const SqlInputSchema = z.object({
  question: z.string().trim().min(1),
  system: z.string().max(20000).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
})

const SqlOutputSchema = z.object({
  sql: z.string(),
  explanation: z.string(),
  tables_used: z.array(z.string()),
})

function buildSqlPrompt(question: string): string {
  return [
    `Database: Turso/libSQL (SQLite dialect). ${SCHEMA_HINT}`,
    `Question: ${question}`,
    'Return strict JSON: {"sql": string, "explanation": string, "tables_used": string[]}.',
    'Only produce SELECT statements. Never write, alter, or drop.',
  ].join('\n')
}

async function runSql(rawInput: unknown, ctx: CapabilityRunContext) {
  const parsed = SqlInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false as const, error: 'Question is required', code: 'VALIDATION_ERROR' }
  }
  const text = await ctx.complete({
    system: parsed.data.system ?? 'You translate questions into read-only SQLite SELECT queries. Return strict JSON only.',
    prompt: buildSqlPrompt(parsed.data.question),
    maxTokens: parsed.data.maxTokens ?? 700,
  })
  const json = extractJsonObject(text) ?? {}
  return {
    success: true as const,
    data: {
      sql: String(json.sql ?? ''),
      explanation: String(json.explanation ?? ''),
      tables_used: Array.isArray(json.tables_used) ? json.tables_used.filter(item => typeof item === 'string') : [],
    },
  }
}

const contentSqlCapability: Capability = {
  id: 'content.sql',
  title: 'Ask your data',
  description: 'Translate a question into a read-only data query.',
  agent: (input: unknown, ctx: CapabilityRunContext) => runSql(input, ctx),
  inputSchema: SqlInputSchema,
  outputSchema: SqlOutputSchema,
  consequential: false,
  stream: 'none',
  render: 'text',
}

export function registerSqlCapabilities(): void {
  if (!capabilityRegistry.has(contentSqlCapability.id)) capabilityRegistry.register(contentSqlCapability)
}

registerSqlCapabilities()

export { contentSqlCapability }
