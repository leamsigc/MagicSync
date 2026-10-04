import plan from './plan.md?raw'
import repair from './repair.md?raw'

/**
 * File-based model prose for the agentic goal layer. Every model-facing
 * system/instruction prompt lives in this folder as Markdown, imported at
 * build time (?raw) so the bundle never depends on the server filesystem —
 * the same mechanism `server/agent/prompts/` and `server/agent/skills/`
 * use (Nitro `agent-raw-text` plugin, `tests/resolve-hook.mjs` in Node).
 * Goal skills import their own sibling `<id>/SKILL.md?raw` directly so a new
 * skill never needs a registry edit; only these generic helpers are shared.
 */
export const GOAL_PLAN_TEMPLATE = plan
export const GOAL_REPAIR_TEMPLATE = repair

/** Replace `{{name}}` placeholders. Unknown placeholders are left untouched. */
export function renderTemplate(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : match
  })
}

/** Extract the `## Role` section body (the model system prompt). Empty when absent. */
export function roleOf(template: string): string {
  const start = template.indexOf('## Role')
  if (start === -1) return ''
  const bodyStart = template.indexOf('\n', start)
  const rest = bodyStart === -1 ? '' : template.slice(bodyStart + 1)
  const end = rest.search(/\r?\n## /)
  const section = end === -1 ? rest : rest.slice(0, end)
  return section.trim()
}

/** Prompt body: template minus frontmatter and the `## Role` section. */
export function promptOf(template: string): string {
  const withoutFrontmatter = template.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  const start = withoutFrontmatter.indexOf('## Role')
  if (start === -1) return withoutFrontmatter.trim()
  const next = withoutFrontmatter.indexOf('\n## ', start)
  const withoutRole = next === -1
    ? withoutFrontmatter.slice(0, start)
    : withoutFrontmatter.slice(0, start) + withoutFrontmatter.slice(next + 1)
  return withoutRole.trim()
}
