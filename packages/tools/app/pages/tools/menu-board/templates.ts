import type { BoardTemplate } from './types'
import { TEMPLATES_BASIC } from './templates-basic'
import { TEMPLATES_GRID } from './templates-grid'
import { TEMPLATES_THEMED } from './templates-themed'

export const MENU_TEMPLATES: BoardTemplate[] = [
  ...TEMPLATES_BASIC,
  ...TEMPLATES_THEMED,
  ...TEMPLATES_GRID,
]

export function getTemplateById(id: string): BoardTemplate | undefined {
  return MENU_TEMPLATES.find(t => t.id === id)
}
