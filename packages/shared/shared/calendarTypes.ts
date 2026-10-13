/**
 * Shared calendar contracts.
 *
 * These types are the single source of truth for both the generic Apple-style
 * grid in `packages/ui` and the post-driven calendar in `packages/scheduler`.
 * The grid knows nothing about posts; the scheduler layer maps posts onto these.
 *
 * `shared` is a leaf layer and imports nothing from `#layers/*`, so the post
 * payload is a generic parameter rather than a `PostWithBusinessData` import.
 */

/** Semantic Nuxt UI color tokens. Matches the template's `Calendar['color']`. */
export type CalendarColorToken = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';

/** The template's "calendar" — here it is a business. */
export interface Calendar {
  id: string;
  name: string;
  color: CalendarColorToken;
}

export type CalendarView = 'day' | 'week' | 'month';

/** Local, timezone-less ISO string: `YYYY-MM-DDTHH:mm:ss`. */
export type LocalDatetime = string;

/**
 * A calendar event.
 *
 * `end` is DERIVED client-side from `start + DEFAULT_DURATION_MINUTES`: a post
 * has a single `scheduledAt` and no duration column, so nothing persists an end.
 * Never send `end` to the server.
 */
export interface CalendarEvent<Post = unknown> {
  id: string;
  /** The business this event belongs to. */
  calendarId: string;
  title: string;
  start: LocalDatetime;
  end: LocalDatetime;
  allDay?: boolean;
  color: CalendarColorToken;
  post: Post;
}

/** A half-hour gives a single post enough visual height in week/day grids. */
export const DEFAULT_DURATION_MINUTES = 30;

/** A drop closer than this is refused rather than scheduled into the past. */
export const SCHEDULE_BUFFER_MS = 5 * 60 * 1000;

/**
 * The two post statuses that may still move.
 *
 * `published` and `failed` are history: one has already left, the other can no
 * longer be trusted to leave. Both refuse a reschedule with a 409 rather than
 * being rewritten behind the caller's back, which is the defect the legacy
 * `PUT /api/v1/posts/[id]:73-75` has.
 */
export const RESCHEDULABLE_STATUSES = ['draft', 'pending'] as const;

export type ReschedulableStatus = (typeof RESCHEDULABLE_STATUSES)[number];

/** Shared by the endpoint's guard and the client's drag guard, so the two agree. */
export function isReschedulableStatus(status: string): boolean {
  return (RESCHEDULABLE_STATUSES as readonly string[]).includes(status);
}
