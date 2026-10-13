import type { CalendarColorToken } from './calendarTypes';

/**
 * The minimum a business has to supply to be given a calendar color.
 * Structural on purpose: `BusinessProfile` satisfies it without `shared`
 * having to depend on `db`.
 */
export interface BusinessIdentity {
  id: string;
  name: string;
}

/** Every token, in assignment order. */
export const BUSINESS_COLOR_TOKENS: readonly CalendarColorToken[] = [
  'primary',
  'info',
  'success',
  'warning',
  'error',
  'secondary',
] as const;

/** Tailwind class maps the calendar and the business card both resolve through. */
export const businessColorClasses: Record<CalendarColorToken, string> = {
  primary: 'bg-primary text-on-primary',
  secondary: 'bg-secondary text-on-secondary',
  info: 'bg-info text-on-info',
  success: 'bg-success text-on-success',
  warning: 'bg-warning text-on-warning',
  error: 'bg-error text-on-error',
};

/**
 * Stable 32-bit FNV-1a. Small, dependency-free, and enough to spread a handful
 * of business names across six tokens without clustering.
 */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The color a business gets when no other business competes for it.
 * Deterministic across renders, reloads and devices, and persisted nowhere.
 */
export function getBusinessColorToken(business: BusinessIdentity): CalendarColorToken {
  return BUSINESS_COLOR_TOKENS[hashString(`${business.id}:${business.name}`) % BUSINESS_COLOR_TOKENS.length]!;
}

/**
 * Hands out a distinct token to every business in the list while tokens last,
 * so a user with three businesses never sees two that look the same. Once all
 * six are used the remaining businesses fall back to their deterministic hash.
 *
 * Pure function of the list: the same list always produces the same map.
 */
export function assignBusinessColorTokens<T extends BusinessIdentity>(businesses: T[]): Map<string, CalendarColorToken> {
  const assignments = new Map<string, CalendarColorToken>();
  const taken = new Set<CalendarColorToken>();

  for (const business of businesses) {
    const token = getBusinessColorToken(business);
    if (!taken.has(token)) {
      taken.add(token);
      assignments.set(business.id, token);
    }
  }

  for (const business of businesses) {
    if (assignments.has(business.id)) continue;
    const free = BUSINESS_COLOR_TOKENS.find(token => !taken.has(token));
    if (free) {
      taken.add(free);
      assignments.set(business.id, free);
      continue;
    }
    assignments.set(business.id, getBusinessColorToken(business));
  }

  return assignments;
}
