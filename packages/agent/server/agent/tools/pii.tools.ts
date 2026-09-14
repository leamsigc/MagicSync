import { Type } from 'typebox'
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent'
import { anonymize, detectRegex, isPiiReady, loadNerEngine, type PiiMatch } from '../../utils/pii'
import type { AgentToolContext } from '../tool-context'

function toolResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }], details: {} }
}

/** Never echo raw personal data back to the model. */
function mask(value: string): string {
  if (value.length <= 2) return '*'.repeat(value.length)
  return `${value[0]}${'*'.repeat(Math.max(value.length - 2, 0))}${value.at(-1)}`
}

interface PiiFinding {
  type: string
  count: number
  samples: string[]
}

function summarize(matches: PiiMatch[]): PiiFinding[] {
  const byType = new Map<string, PiiFinding>()
  for (const match of matches) {
    const entry = byType.get(match.type) ?? { type: match.type, count: 0, samples: [] }
    entry.count += 1
    if (entry.samples.length < 3) entry.samples.push(mask(match.value))
    byType.set(match.type, entry)
  }
  return Array.from(byType.values())
}

async function detectAll(text: string): Promise<PiiMatch[]> {
  const ner = await loadNerEngine()
  const nerMatches = ner ? await ner.detect(text) : []
  return [...detectRegex(text), ...nerMatches]
}

export function createPiiTools(_ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'pii_scan',
      label: 'Scan for PII',
      description: 'Detect or anonymize personal data (emails, phones, IBANs, cards, names, locations). Findings are masked; raw values are never returned.',
      parameters: Type.Object({
        text: Type.String({ description: 'Text to scan' }),
        action: Type.Optional(Type.Union([Type.Literal('detect'), Type.Literal('anonymize')], { description: 'detect (default) or anonymize' })),
      }),
      execute: async (_toolCallId, params) => {
        if (params.action === 'anonymize') {
          const result = await anonymize(params.text)
          return toolResult({
            ready: isPiiReady(),
            text: result.text,
            mappings: result.mappings.map(mapping => ({ surrogate: mapping.surrogate })),
          })
        }
        const matches = await detectAll(params.text)
        const findings = summarize(matches)
        return toolResult({
          ready: isPiiReady(),
          risk: findings.length === 0 ? 'none' : findings.some(finding => finding.type !== 'LOCATION') ? 'high' : 'low',
          findings,
        })
      },
    }),
  ]
}
