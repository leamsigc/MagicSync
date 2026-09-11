/**
 * Unwrap a ServiceResponse or throw its error with a fallback message.
 * Collapses the `if (!result.success || !result.data)` idiom so orchestrators
 * stay within the complexity gate. Callers catch and convert to
 * `{ success: false, ... }` (services never throw by convention).
 */
export function orThrow<T>(result: { success: boolean, data?: T, error?: string }, fallback: string): T {
  if (!result.success || !result.data) {
    throw new Error(result.error || fallback)
  }
  return result.data
}
