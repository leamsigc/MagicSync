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
import ideaGeneration from './idea-generation.md?raw'
import topicScan from './topic-scan.md?raw'
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
  ideaGeneration,
  topicScan,
  pii,
} as const

/**
 * Per-kind format guidance for topic batches. Keyed by batch kind; the
 * pipeline selects the entry and renders it into the topic-scan prompt
 * (and the plugin's format hint) — no model-facing prose in services.
 */
export const TOPIC_SCAN_KIND_HINTS: Record<string, string> = {
  days: 'One idea per day; each card title carries the angle and the brief opens with the hook.',
  carousel: 'Each idea must work as a multi-slide carousel; the brief lists the slide angles in order.',
  reel: 'Each idea must work as a short-form video; the brief opens with the spoken hook and notes the visual.',
  repurpose: 'Each idea reframes the topic for the platform; the brief notes which angle it adapts.',
}

export type AgentPromptName = keyof typeof AGENT_PROMPTS

/** Replace `{{name}}` placeholders. Unknown placeholders are left untouched. */
export function renderPrompt(name: AgentPromptName, vars: Record<string, string> = {}): string {
  const template = AGENT_PROMPTS[name]
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : match
  })
}
