/**
 * User-facing step labels. Business owners see outcomes, never tool or skill
 * internals ("Researching competitors", not "calling web_search").
 */
const SKILL_LABELS: Record<string, string> = {
  'research-business': 'Understanding your business',
  'analyze-business': 'Analyzing your business',
  'research-competitors': 'Researching competitors',
  'discover-opportunities': 'Finding opportunities',
  'create-content-ideas': 'Generating content ideas',
  'create-marketing-plan': 'Building your plan',
  'identify-next-action': 'Identifying your next best action',
}

export function stepLabel(skillId: string, title: string): string {
  return SKILL_LABELS[skillId] ?? `Working on: ${title}`
}
