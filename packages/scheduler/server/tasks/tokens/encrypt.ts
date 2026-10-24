import { eq } from 'drizzle-orm'
import { socialMediaAccounts } from '#layers/BaseDB/db/socialMedia/socialMedia'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { decryptKey, encryptKey } from '#layers/BaseAuth/server/utils/AuthHelpers'

/**
 * Bring every stored token to exactly one layer of encryption.
 *
 * Two eras need repair:
 *   1. rows written before the audit stored plaintext in `access_token`;
 *   2. rows written by the Bluesky / dev-null connect paths were encrypted by
 *      the caller and again by the service → `enc(enc(secret))`.
 *
 * Encrypted-once values are left untouched. Idempotent: running it twice is a
 * no-op.
 */
async function normalizeToken(stored: string): Promise<string | null> {
  const once = await decryptKey(stored)
  if (once === null) {
    // Plaintext (or a value encrypted with a different key) — encrypt it.
    return encryptKey(stored)
  }
  const twice = await decryptKey(once)
  if (twice === null) return null
  // Double-encrypted: keep a single layer around the real secret.
  return encryptKey(twice)
}

export default defineTask({
  meta: {
    name: 'tokens:encrypt',
    description: 'Encrypt legacy plaintext and collapse double-encrypted social tokens',
  },
  async run() {
    const db = useDrizzle()
    const rows = await db.select().from(socialMediaAccounts)
    let migrated = 0

    for (const row of rows) {
      const patch: Record<string, unknown> = {}

      if (row.accessToken) {
        const normalized = await normalizeToken(row.accessToken)
        if (normalized) {
          patch.accessToken = normalized
          patch.accessTokenEncrypted = normalized
        }
      }

      if (row.refreshToken) {
        const normalized = await normalizeToken(row.refreshToken)
        if (normalized) {
          patch.refreshToken = normalized
          patch.refreshTokenEncrypted = normalized
        }
      }

      if (Object.keys(patch).length === 0) continue
      await db.update(socialMediaAccounts).set(patch).where(eq(socialMediaAccounts.id, row.id))
      migrated += 1
    }

    return { result: { scanned: rows.length, migrated } }
  },
})
