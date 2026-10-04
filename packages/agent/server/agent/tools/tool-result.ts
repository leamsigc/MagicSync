/**
 * T28 — the Flue tool boundary contract every agent tool module speaks.
 *
 * A Flue tool's `run` returns the canonical `{ output }` envelope and the model
 * receives `output` serialized as JSON. The pi path used to wrap every payload
 * in `{ content: [{ type: 'text', text: JSON.stringify(payload) }], details }`,
 * so the same helper now returns `{ output }` instead — one shape for all ten
 * tool modules, and the model reads structured JSON rather than a JSON string.
 *
 * Failures are unchanged: a tool throws a typed `CODE: message` error, Flue
 * settles the call as a tool error, and the run continues within bounds. Each
 * module keeps its own domain prefix through a one-line `toolError` binding.
 */

/** Successful tool result: the payload the model receives as JSON. */
export function toolResult<T>(payload: T): { output: T } {
  return { output: payload }
}

/** Typed tool failure; `code` is the service code when it has one. */
export function toolFailure(code: string | undefined, message: string, fallbackCode: string): never {
  throw new Error(`${code ?? fallbackCode}: ${message}`)
}
