import { CalendarDate, getLocalTimeZone, parseDate, Time, toCalendarDateTime, today } from '@internationalized/date';
import dayjs from 'dayjs';
import { SCHEDULE_BUFFER_MS, type CalendarView, type LocalDatetime } from '#layers/BaseShared/shared/calendarTypes';

export interface DateRange {
  start: Date;
  end: Date;
}

/** Rows in the month grid. Fixed so the grid height never jumps between months. */
export const MONTH_WEEKS = 6;
/** Weeks the month view fetches up front: the grid plus what a tall viewport shows. */
export const MONTH_FETCH_WEEKS = 12;
/** Drag snapping, in minutes. */
export const SNAP_MINUTES = 15;

/**
 * True when the day is before today (local). Past days render dimmed and never
 * open the create modal — a click there toasts instead, the way the retired
 * FullCalendar wrapper did.
 */
export function isPastDay(day: Date): boolean {
  return dayjs(day).isBefore(dayjs().startOf('day'))
}

/**
 * Pushes a drilled instant up to now plus the schedule buffer when it fell
 * behind. Clicking today at 8pm drafts 9am — two hours dead — so the create
 * modal opens with a default the server accepts instead: the user's time plus
 * five minutes, the same floor the schedule endpoint enforces.
 *
 * Past *days* stay the caller's decision — the shell still refuses those with
 * a toast. This only repairs the clock time within an allowed day.
 */
export function pushDrillToFuture(target: Date): Date {
  const floor = Date.now() + SCHEDULE_BUFFER_MS

  return target.getTime() < floor ? new Date(floor) : target
}

export function toCalendarDate(date: Date): CalendarDate {
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function toTime(date: Date): Time {
  return new Time(date.getHours(), date.getMinutes());
}

// `getLocalTimeZone` resolves an `Intl.DateTimeFormat` on every call and the
// month view runs date math on every scroll frame.
let localTimeZone: string | undefined;

function timeZone(): string {
  localTimeZone ??= getLocalTimeZone();
  return localTimeZone;
}

export function toDate(date: CalendarDate): Date {
  return date.toDate(timeZone());
}

export function toDateTime(date: CalendarDate, time: Time): Date {
  return toCalendarDateTime(date, time).toDate(timeZone());
}

export function todayDate(): CalendarDate {
  return today(timeZone());
}

/**
 * Identifies a local calendar day. Built from date parts so it stays correct
 * across DST and costs less than a formatter.
 */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** The day a grid cell stands for, as the `data-date` a pointer gesture reads back. */
export function isoDate(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD');
}

// A drag spends dozens of moves inside one cell; caching avoids rebuilding a
// `CalendarDate` and converting it back through the timezone each time.
let lastISO: string | undefined;
let lastDate: Date | undefined;

export function dateFromISO(iso: string): Date {
  if (iso !== lastISO) {
    lastISO = iso;
    lastDate = toDate(parseDate(iso));
  }
  return lastISO === iso ? lastDate! : toDate(parseDate(iso));
}

/** The day under a point, from whichever cell is topmost there. */
export function dateAtPoint(x: number, y: number): Date | null {
  for (const element of document.elementsFromPoint(x, y)) {
    const iso = (element as HTMLElement).dataset?.date;
    if (iso) {
      try {
        return dateFromISO(iso);
      } catch {
        // Not a parsable day cell
      }
    }
  }
  return null;
}

/** Monday-based week start. */
function startOfWeek(date: Date): Date {
  const offset = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Minutes since local midnight. */
export function minutesIntoDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** A date at a given number of minutes past local midnight. */
export function dateWithMinutes(date: Date, minutes: number): Date {
  const next = new Date(date);
  next.setHours(0, minutes, 0, 0);
  return next;
}

/** Rounds to the nearest `SNAP_MINUTES` boundary, rounding half up. */
export function snapMinutes(minutes: number, snap: number = SNAP_MINUTES): number {
  return Math.round(minutes / snap) * snap;
}

/** Ranges are [start, end): the end boundary is the first excluded instant. */
export function weekRange(date: CalendarDate, days = 7): DateRange {
  const start = days === 7 ? startOfWeek(toDate(date)) : toDate(date);
  return { start, end: addDays(start, days) };
}

/** Always six rows of seven days. */
export function monthRange(date: CalendarDate): DateRange {
  const start = startOfWeek(startOfMonth(toDate(date)));
  return { start, end: addDays(start, MONTH_WEEKS * 7) };
}

export function monthFetchRange(date: CalendarDate): DateRange {
  const { start } = monthRange(date);
  return { start, end: addDays(start, MONTH_FETCH_WEEKS * 7) };
}

export function rangeFor(view: CalendarView, date: CalendarDate): DateRange {
  if (view === 'month') {
    return monthFetchRange(date);
  }
  return weekRange(date, view === 'day' ? 1 : 7);
}

export function eachDay({ start, end }: DateRange): Date[] {
  const days: Date[] = [];
  for (let day = new Date(start); day < end; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

/**
 * Floating local ISO form. The server stores and returns local datetimes in
 * this shape so the two sides never disagree on what a string means.
 */
export function toLocalDatetime(date: Date): LocalDatetime {
  return dayjs(date).format('YYYY-MM-DDTHH:mm:ss');
}

export function parseLocalDatetime(value: LocalDatetime): Date {
  const parsed = dayjs(value, 'YYYY-MM-DDTHH:mm:ss');
  return parsed.isValid() ? parsed.toDate() : new Date(value);
}

const timeFormat = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric' });
const fullDateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const weekdayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long' });
const shortMonthFormat = new Intl.DateTimeFormat('en-US', { month: 'short' });
const shortMonthYearFormat = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

export function formatTime(date: Date): string {
  return timeFormat.format(date);
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatDay(date: Date): string {
  return dayFormat.format(date);
}

export function formatFullDate(date: Date): string {
  return fullDateFormat.format(date);
}

export function formatWeekday(date: Date): string {
  return weekdayFormat.format(date);
}

export function formatMonth(date: Date): string {
  return monthFormat.format(date);
}

export function formatShortMonth(date: Date): string {
  return shortMonthFormat.format(date);
}

export interface RangeTitle {
  months: string;
  year: string;
}

export function formatRangeTitle({ start, end }: DateRange): RangeTitle {
  const last = addDays(end, -1);
  const year = String(last.getFullYear());

  if (start.getMonth() === last.getMonth()) {
    return { months: monthFormat.format(start), year };
  }

  const startMonth = (start.getFullYear() !== last.getFullYear() ? shortMonthYearFormat : shortMonthFormat).format(start);
  const endMonth = shortMonthFormat.format(last);
  return { months: `${startMonth} – ${endMonth}`, year };
}
