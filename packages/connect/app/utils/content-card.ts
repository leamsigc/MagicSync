/**
 * Pure presentation helpers for the content board cards.
 *
 * The board is a kanban whose only real fields are `format`, `platforms`,
 * `priority`, the three timestamps and `createdBy`. The reference design shows a
 * task code, a date chip, a priority mark and an assignee avatar, so these
 * helpers derive each of those from data the server actually returned — nothing
 * here invents a value the owner did not produce.
 */

/** Short, stable board code: `CNT-` + the last three characters of the row id. */
export function contentCardCode(id: string): string {
  const compact = id.replace(/[^a-z0-9]/gi, '')
  return `CNT-${compact.slice(-3).toUpperCase().padStart(3, '0')}`
}

/** i18n key plus the raw values the caller's `t()` needs to render the chip. */
export interface CardDayLabel {
  key: string
  /** Weekday index (0 = Sunday) for the `weekday` branch. */
  weekday?: number
  /** The date, formatted by the caller in the active locale. */
  date?: Date
}

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * Relative date chip: Today, Yesterday, the weekday inside the last week, then
 * an absolute `Mon D` date. Returns `null` when there is no usable timestamp.
 */
export function cardDayLabel(iso: string | null | undefined, now: Date = new Date()): CardDayLabel | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (days <= 0) return { key: 'board.day.today' }
  if (days === 1) return { key: 'board.day.yesterday' }
  if (days < 7) return { key: 'board.day.weekday', weekday: date.getDay() }
  return { key: 'board.day.date', date }
}

/** The most relevant timestamp for a card: when published, scheduled, else changed. */
export function cardDate(item: { publishedAt?: string | null, scheduledAt?: string | null, updatedAt?: string | null }): string | null {
  return item.publishedAt ?? item.scheduledAt ?? item.updatedAt ?? null
}

export type PriorityTier = 'none' | 'low' | 'medium' | 'high' | 'urgent'

/** Buckets the numeric priority into the four tiers the design colours by. */
export function priorityTier(priority: number | undefined): PriorityTier {
  const value = priority ?? 0
  if (value <= 0) return 'none'
  if (value === 1) return 'low'
  if (value === 2) return 'medium'
  if (value === 3) return 'high'
  return 'urgent'
}
