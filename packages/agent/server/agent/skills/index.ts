import langsearch from './langsearch/SKILL.md?raw'
import socialResearch from './social-research/SKILL.md?raw'
import contentWriter from './content-writer/SKILL.md?raw'
import humanizer from './humanizer/SKILL.md?raw'
import trendScout from './trend-scout/SKILL.md?raw'
import piiGuardian from './pii-guardian/SKILL.md?raw'
import contentOps from './content-ops/SKILL.md?raw'
import evidenceRubric from './social-research/references/evidence-rubric.md?raw'

export interface BundledSkill {
  slug: string
  name: string
  description: string
  tools: string[]
  /** Full SKILL.md (frontmatter + instructions) returned by load_skill. */
  body: string
  /** Progressive-disclosure files loadable by name through load_skill. */
  references: Record<string, string>
}

interface SkillFileMeta {
  name: string
  description: string
}

/** Parse the YAML-ish frontmatter subset used by bundled SKILL.md files. */
function parseSkillMeta(body: string): SkillFileMeta | null {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const fields: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator > 0) fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }
  return fields.name && fields.description
    ? { name: fields.name, description: fields.description }
    : null
}

function bundledSkill(slug: string, body: string, tools: string[], references: Record<string, string> = {}): BundledSkill {
  const meta = parseSkillMeta(body)
  return {
    slug,
    name: meta?.name ?? slug,
    description: meta?.description ?? '',
    tools,
    body,
    references,
  }
}

/** Single source of truth for file-based system skills. */
export const BUNDLED_SKILLS: BundledSkill[] = [
  bundledSkill('langsearch', langsearch, ['web_search']),
  bundledSkill('social-research', socialResearch, ['web_search', 'scrape_url', 'retrieve'], {
    'references/evidence-rubric.md': evidenceRubric,
  }),
  bundledSkill('content-writer', contentWriter, ['write_post', 'apply_template', 'retrieve']),
  bundledSkill('humanizer', humanizer, ['humanize']),
  bundledSkill('trend-scout', trendScout, ['scan_trends', 'web_search', 'board_add_cards']),
  bundledSkill('pii-guardian', piiGuardian, ['pii_scan']),
  bundledSkill('content-ops', contentOps, ['subagent', 'board_list', 'board_move', 'board_add_cards']),
]

export function findBundledSkill(id: string): BundledSkill | undefined {
  return BUNDLED_SKILLS.find(skill => skill.slug === id || skill.name === id)
}

/** Skills selected by slug or name, in registry order. */
export function selectBundledSkills(ids: string[]): BundledSkill[] {
  const wanted = new Set(ids)
  return BUNDLED_SKILLS.filter(skill => wanted.has(skill.slug) || wanted.has(skill.name))
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * pi only lists skills when a file-reading tool exists; our sessions have none,
 * so the runtime injects this block itself and `load_skill` serves the bodies.
 */
export function formatBundledSkillsForPrompt(skills: BundledSkill[]): string {
  if (skills.length === 0) return ''
  const lines = [
    'The following skills provide specialized instructions for specific tasks.',
    'Use the `load_skill` tool with a skill name to load its full instructions when a task matches its description.',
    '',
    '<available_skills>',
  ]
  for (const skill of skills) {
    lines.push('  <skill>')
    lines.push(`    <name>${escapeXml(skill.name)}</name>`)
    lines.push(`    <description>${escapeXml(skill.description)}</description>`)
    lines.push(`    <tools>${escapeXml(skill.tools.join(', '))}</tools>`)
    lines.push('  </skill>')
  }
  lines.push('</available_skills>')
  return lines.join('\n')
}

/** Resolve a reference file path (`./references/x.md` and `references/x.md` both work). */
export function loadBundledReference(skill: BundledSkill, file: string): string | null {
  const normalized = file.replace(/^\.\//, '')
  return skill.references[normalized] ?? null
}
