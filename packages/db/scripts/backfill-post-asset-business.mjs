import { createClient } from '@libsql/client'

/**
 * One-time backfill: attach every asset referenced by a business post to that
 * post's business. Assets uploaded before business scoping have `business_id`
 * NULL, which makes them owner-only even though the post is shared.
 *
 * Usage:
 *   cd packages/db && pnpm db:backfill-post-assets
 */

const url = process.env.NUXT_TURSO_DATABASE_URL
const authToken = process.env.NUXT_TURSO_AUTH_TOKEN

if (!url) {
  console.error('NUXT_TURSO_DATABASE_URL is required')
  process.exit(1)
}

const db = createClient({
  url,
  ...(authToken ? { authToken } : {}),
})

const posts = await db.execute(`
  SELECT id, business_id, media_assets
  FROM posts
  WHERE business_id IS NOT NULL
    AND media_assets IS NOT NULL
    AND media_assets != ''
`)

let updated = 0
let skipped = 0

for (const row of posts.rows) {
  const businessId = typeof row.business_id === 'string' ? row.business_id : ''
  if (!businessId) {
    skipped++
    continue
  }

  let assetIds = []
  try {
    const parsed = JSON.parse(String(row.media_assets))
    if (Array.isArray(parsed)) {
      assetIds = parsed.filter(id => typeof id === 'string' && id.length > 0)
    }
  } catch {
    skipped++
    continue
  }

  for (const assetId of assetIds) {
    const result = await db.execute({
      sql: 'UPDATE assets SET business_id = ? WHERE id = ? AND business_id IS NULL',
      args: [businessId, assetId],
    })
    updated += result.rowsAffected
  }
}

console.log(`Scanned ${posts.rows.length} posts, updated ${updated} asset rows, skipped ${skipped} malformed posts`)
