/**
 * Locale prefixes used with the `prefix_except_default` strategy. The default
 * `en` is never prefixed, but stripping it too keeps the helper total.
 */
const LOCALE_PREFIX_PATTERN = /^\/(es|de|fr|en)(?=\/|$)/

/**
 * Strips a locale prefix (`/de/app/calendar` → `/app/calendar`) so path
 * matching works identically in every language. Unprefixed paths and `/`
 * pass through untouched.
 */
export function stripLocalePrefix(path: string): string {
  return path.replace(LOCALE_PREFIX_PATTERN, '') || '/'
}
