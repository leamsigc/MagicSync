/**
 * Calendar grid geometry and packing.
 *
 * `calendarDates.ts` owns the range maths and the local-ISO conversions; this
 * file owns the pixel maths and the cluster packing every view shares, plus the
 * handful of day primitives the layout helpers need that `calendarDates.ts`
 * deliberately keeps private.
 */
import type { CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'
import { parseLocalDatetime } from './calendarDates'

/** Height of one hour row in the timed grids. */
export const HOUR_HEIGHT = 64
export const PX_PER_MINUTE = HOUR_HEIGHT / 60
/** A painted minimum, not a duration floor: a 15-minute event still draws at this height to stay readable. */
export const MIN_EVENT_MINUTES = 30
export const DAY_MINUTES = 24 * 60
/** How far the pointer has to travel before a gesture counts as a drag rather than a click. */
export const DRAG_THRESHOLD = 5

export interface PositionedEvent {
  event: CalendarEvent
  top: number
  height: number
  left: number
  width: number
}

export interface AllDayPositionedEvent {
  event: CalendarEvent
  colStart: number
  colSpan: number
  lane: number
}

interface DayItem {
  event: CalendarEvent
  startMin: number
  endMin: number
}

interface AllDayItem {
  event: CalendarEvent
  colStart: number
  colSpan: number
}

/** Local midnight, the origin every timed-grid measurement starts from. */
export function startOfDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

/** Calendar days, so the wall clock survives a DST boundary. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

/** Epoch minutes between two instants. */
export function differenceInMinutes(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 60_000)
}

/** Calendar days between two dates, ignoring the time of day. */
export function differenceInCalendarDays(later: Date, earlier: Date): number {
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / 86_400_000)
}

/** Pixels of a drag, read back as minutes of the day. */
export function minutesFromOffset(px: number): number {
  return px / PX_PER_MINUTE
}

function toDayItem(event: CalendarEvent, dayStart: Date): DayItem {
  return {
    event,
    startMin: Math.max(0, differenceInMinutes(parseLocalDatetime(event.start), dayStart)),
    endMin: Math.min(DAY_MINUTES, differenceInMinutes(parseLocalDatetime(event.end), dayStart))
  }
}

function overlapsDay(item: DayItem): boolean {
  return item.endMin > item.startMin
}

function toPaintedHeight(item: DayItem): DayItem {
  return { ...item, endMin: Math.max(item.endMin, item.startMin + MIN_EVENT_MINUTES) }
}

function byStartThenLength(a: DayItem, b: DayItem): number {
  return a.startMin - b.startMin || b.endMin - a.endMin
}

function toDayItems(events: CalendarEvent[], day: Date): DayItem[] {
  const dayStart = startOfDay(day)

  return events
    .map(event => toDayItem(event, dayStart))
    .filter(overlapsDay)
    .map(toPaintedHeight)
    .sort(byStartThenLength)
}

/**
 * Splits one overlapping cluster into the minimum number of columns, the
 * approach Google Calendar uses.
 */
function packCluster(cluster: DayItem[]): PositionedEvent[] {
  const columns: number[] = []

  const assigned = cluster.map((item) => {
    let index = columns.findIndex(end => end <= item.startMin)
    if (index === -1) {
      index = columns.length
    }
    columns[index] = item.endMin

    return index
  })

  return cluster.map((item, index) => ({
    event: item.event,
    top: item.startMin * PX_PER_MINUTE,
    height: (item.endMin - item.startMin) * PX_PER_MINUTE,
    left: assigned[index]! / columns.length * 100,
    width: 100 / columns.length
  }))
}

function packClusters(items: DayItem[]): PositionedEvent[] {
  const positioned: PositionedEvent[] = []
  let cluster: DayItem[] = []
  let clusterEnd = -Infinity

  for (const item of items) {
    if (cluster.length && item.startMin >= clusterEnd) {
      positioned.push(...packCluster(cluster))
      cluster = []
      clusterEnd = -Infinity
    }
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }

  if (cluster.length) {
    positioned.push(...packCluster(cluster))
  }

  return positioned
}

/** Stacks the timed events of one day into non-overlapping columns. */
export function layoutDay(events: CalendarEvent[], day: Date): PositionedEvent[] {
  return packClusters(toDayItems(events, day))
}

function toAllDayItem(event: CalendarEvent, first: Date, total: number): AllDayItem {
  const colStart = Math.max(0, differenceInCalendarDays(parseLocalDatetime(event.start), first))

  return { event, colStart, colSpan: Math.min(total, differenceInCalendarDays(parseLocalDatetime(event.end), first)) - colStart }
}

function spansColumn(item: AllDayItem): boolean {
  return item.colSpan > 0
}

function byColumnThenSpan(a: AllDayItem, b: AllDayItem): number {
  return a.colStart - b.colStart || b.colSpan - a.colSpan
}

/** Greedy lane packing for the all-day header row. */
export function layoutAllDay(events: CalendarEvent[], days: Date[]): AllDayPositionedEvent[] {
  const first = days[0]
  if (!first) {
    return []
  }

  const items = events
    .map(event => toAllDayItem(event, first, days.length))
    .filter(spansColumn)
    .sort(byColumnThenSpan)

  const lanes: number[] = []

  return items.map((item) => {
    let lane = lanes.findIndex(end => end <= item.colStart)
    if (lane === -1) {
      lane = lanes.length
    }
    lanes[lane] = item.colStart + item.colSpan

    return { ...item, lane }
  })
}

/** The geometry an event block and its drag ghost share. */
export function eventBlockStyle(positioned: PositionedEvent, height = positioned.height) {
  return {
    // Clears the hour lines it starts and ends on by a pixel, the same gap it
    // leaves on both inline edges, so the grid shows between blocks
    top: `${positioned.top + 2}px`,
    height: `${height - 3}px`,
    insetInlineStart: `calc(${positioned.left}% + 1px)`,
    width: `calc(${positioned.width}% - 2px)`
  }
}

/** The element that actually scrolls inside a `UScrollArea`.
 *
 * Nuxt UI scrolls on the area root itself (`data-slot="root"` carries the
 * overflow); older markup nests a reka viewport child instead. The old version
 * only knew the child selector, so it handed every caller `null` and no timed
 * grid ever scrolled — the grid sat at midnight until the user dragged it.
 */
export function scrollViewport(root: HTMLElement | null | undefined): HTMLElement | null {
  if (!root) {
    return null
  }

  const style = getComputedStyle(root)

  if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
    return root
  }

  return root.querySelector('[data-reka-scroll-area-viewport],[data-slot="viewport"]')
}
