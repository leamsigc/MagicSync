/**
 * Calendar color maps.
 *
 * Static class maps so Tailwind sees the full class names at build time. Every
 * key is a `CalendarColorToken`, so a business's derived token is enough to
 * dress an event, a chip or a dot without the grid knowing what a business is.
 *
 * `data-active` is the hover shade held: a chip wears it while its popover is
 * open. A variant rather than a second `bg-*`, which would leave the two to
 * sort themselves out in the stylesheet.
 */
import type { CalendarColorToken } from '#layers/BaseShared/shared/calendarTypes'

export const eventBlockClasses: Record<CalendarColorToken, string> = {
  primary: 'bg-primary/15 hover:bg-primary/25 data-active:bg-primary/25 text-primary border-primary',
  secondary: 'bg-secondary/15 hover:bg-secondary/25 data-active:bg-secondary/25 text-secondary border-secondary',
  info: 'bg-info/15 hover:bg-info/25 data-active:bg-info/25 text-info border-info',
  success: 'bg-success/15 hover:bg-success/25 data-active:bg-success/25 text-success border-success',
  warning: 'bg-warning/15 hover:bg-warning/25 data-active:bg-warning/25 text-warning border-warning',
  error: 'bg-error/15 hover:bg-error/25 data-active:bg-error/25 text-error border-error'
}

/**
 * The month cell has no room for a dot and a time, so below `lg` a timed chip
 * becomes Apple's tinted pill: the calendar color carried by the fill, only the
 * title inside.
 */
export const eventChipCompactClasses: Record<CalendarColorToken, string> = {
  primary: 'max-lg:bg-primary/15 max-lg:text-primary',
  secondary: 'max-lg:bg-secondary/15 max-lg:text-secondary',
  info: 'max-lg:bg-info/15 max-lg:text-info',
  success: 'max-lg:bg-success/15 max-lg:text-success',
  warning: 'max-lg:bg-warning/15 max-lg:text-warning',
  error: 'max-lg:bg-error/15 max-lg:text-error'
}

export const calendarDotClasses: Record<CalendarColorToken, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error'
}

// The focus ring the button theme paints: the colour at a quarter, which only
// gets a width once `focus-visible` gives the outline one
export const eventOutlineClasses: Record<CalendarColorToken, string> = {
  primary: 'outline-primary/25',
  secondary: 'outline-secondary/25',
  info: 'outline-info/25',
  success: 'outline-success/25',
  warning: 'outline-warning/25',
  error: 'outline-error/25'
}
