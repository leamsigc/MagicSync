import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { ServiceResponse } from './types'
import { entityDetails } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { encryptSecret, isEncryptedSecret, revealSecret } from '#layers/BaseDB/server/utils/publish-crypto'

// entitydetails-kv: one row per user for external tool backends. Secrets are
// AES-256-GCM envelopes at rest and only decrypted into memory server-side.
export const TOOL_BACKENDS_ENTITY_TYPE = 'user_tool_backends'

const ToolBackendDetailsSchema = z.object({
  scrapegraphApiKey: z.string().nullish(),
  langsearchApiKey: z.string().nullish(),
  pythonBackendUrl: z.string().nullish(),
  pythonBackendToken: z.string().nullish(),
})

export interface ToolBackends {
  scrapegraphApiKey: string | null
  langsearchApiKey: string | null
  pythonBackendUrl: string | null
  pythonBackendToken: string | null
  hasScrapegraphKey: boolean
  hasLangsearchKey: boolean
  hasPythonToken: boolean
}

export interface ToolBackendPatch {
  scrapegraphApiKey?: string | null
  langsearchApiKey?: string | null
  pythonBackendUrl?: string | null
  pythonBackendToken?: string | null
}

function parseDetails(raw: unknown): z.infer<typeof ToolBackendDetailsSchema> {
  const parsed = ToolBackendDetailsSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
}

function encryptOrUndefined(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return null
  return isEncryptedSecret(trimmed) ? trimmed : encryptSecret(trimmed)
}

/** undefined keeps the stored secret; blank clears it; text encrypts it. */
function mergeSecret(patchValue: string | null | undefined, current: string | null | undefined): string | null {
  if (patchValue === undefined) return current ?? null
  return encryptOrUndefined(patchValue) ?? null
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  }
  catch {
    return false
  }
}

function toPublic(details: z.infer<typeof ToolBackendDetailsSchema>): ToolBackends {
  const scrapegraphApiKey = revealSecret(details.scrapegraphApiKey ?? null)
  const langsearchApiKey = revealSecret(details.langsearchApiKey ?? null)
  const pythonBackendToken = revealSecret(details.pythonBackendToken ?? null)
  return {
    scrapegraphApiKey,
    langsearchApiKey,
    pythonBackendUrl: details.pythonBackendUrl ?? null,
    pythonBackendToken,
    hasScrapegraphKey: Boolean(scrapegraphApiKey),
    hasLangsearchKey: Boolean(langsearchApiKey),
    hasPythonToken: Boolean(pythonBackendToken),
  }
}

export class ToolBackendsService {
  private db = useDrizzle()

  async get(userId: string): Promise<ServiceResponse<ToolBackends>> {
    try {
      const [row] = await this.db
        .select()
        .from(entityDetails)
        .where(and(
          eq(entityDetails.entityId, userId),
          eq(entityDetails.entityType, TOOL_BACKENDS_ENTITY_TYPE),
        ))
        .limit(1)
      return { success: true, data: toPublic(parseDetails(row?.details)) }
    }
    catch {
      return { success: false, error: 'Failed to load tool backends' }
    }
  }

  async save(userId: string, patch: ToolBackendPatch): Promise<ServiceResponse<ToolBackends>> {
    try {
      const nextUrl = patch.pythonBackendUrl === undefined
        ? undefined
        : (patch.pythonBackendUrl?.trim() || null)
      if (nextUrl && !isPublicHttpUrl(nextUrl)) {
        return { success: false, error: 'Python backend URL must be a public http(s) URL', code: 'VALIDATION_ERROR' }
      }

      const [row] = await this.db
        .select()
        .from(entityDetails)
        .where(and(
          eq(entityDetails.entityId, userId),
          eq(entityDetails.entityType, TOOL_BACKENDS_ENTITY_TYPE),
        ))
        .limit(1)
      const current = parseDetails(row?.details)

      const details = {
        scrapegraphApiKey: mergeSecret(patch.scrapegraphApiKey, current.scrapegraphApiKey),
        langsearchApiKey: mergeSecret(patch.langsearchApiKey, current.langsearchApiKey),
        pythonBackendUrl: nextUrl === undefined ? (current.pythonBackendUrl ?? null) : nextUrl,
        pythonBackendToken: mergeSecret(patch.pythonBackendToken, current.pythonBackendToken),
      }
      const now = new Date()
      if (row) {
        await this.db.update(entityDetails)
          .set({ details, updatedAt: now })
          .where(eq(entityDetails.id, row.id))
      }
      else {
        await this.db.insert(entityDetails).values({
          id: crypto.randomUUID(),
          entityId: userId,
          entityType: TOOL_BACKENDS_ENTITY_TYPE,
          details,
          createdAt: now,
          updatedAt: now,
        })
      }
      return { success: true, data: toPublic(details) }
    }
    catch {
      return { success: false, error: 'Failed to save tool backends' }
    }
  }
}

export const toolBackendsService = new ToolBackendsService()
