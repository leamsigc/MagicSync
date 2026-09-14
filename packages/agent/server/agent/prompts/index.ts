import base from './base.md?raw'
import orchestrator from './orchestrator.md?raw'
import research from './research.md?raw'
import researchSynthesis from './research-synthesis.md?raw'
import researchTopic from './research-topic.md?raw'
import writePost from './write-post.md?raw'
import humanize from './humanize.md?raw'
import revise from './revise.md?raw'
import trendScan from './trend-scan.md?raw'
import ideaScan from './idea-scan.md?raw'
import pii from './pii.md?raw'

/**
 * Named prompt files. Every model-facing system/instruction prompt lives in
 * this folder, one file per action, imported at build time (?raw) so the
 * bundle never depends on the server filesystem.
 */
export const AGENT_PROMPTS = {
  base,
  orchestrator,
  research,
  researchSynthesis,
  researchTopic,
  writePost,
  humanize,
  revise,
  trendScan,
  ideaScan,
  pii,
} as const

export type AgentPromptName = keyof typeof AGENT_PROMPTS

/** Replace `{{name}}` placeholders. Unknown placeholders are left untouched. */
export function renderPrompt(name: AgentPromptName, vars: Record<string, string> = {}): string {
  const template = AGENT_PROMPTS[name]
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : match
  })
}
