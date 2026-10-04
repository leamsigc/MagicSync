/**
 * One place to read a failed `$fetch` so every content-flow failure raises a
 * toast with a real message. The API routes return
 * `createError({ statusMessage, data: { code } })`, so the code is where the
 * machine-readable reason lives and the status message is the human one.
 */

interface ApiErrorBody {
  statusMessage?: string
  message?: string
  data?: { code?: string }
}

function errorBody(error: unknown): ApiErrorBody | undefined {
  return (error as { data?: ApiErrorBody } | null)?.data
}

/** The capability error code the adapter forwarded, when there is one. */
export function contentApiErrorCode(error: unknown): string | undefined {
  return errorBody(error)?.data?.code
}

/** Best available human message for a failed request; never empty. */
export function contentApiError(error: unknown): string {
  const body = errorBody(error)
  return body?.statusMessage
    || body?.message
    || (error instanceof Error ? error.message : String(error))
}
