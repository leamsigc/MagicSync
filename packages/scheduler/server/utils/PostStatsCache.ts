/**
 * Post insights cache — scoped per post + platform + account.
 *
 * Uses the entity_details table as a strict-manual cache: rows are written once
 * and served forever until the caller explicitly refreshes (passing ?refresh=1),
 * which overwrites the row with fresh data.
 *
 * The cache key is scoped so fetching stats for one platform never overwrites
 * another platform's cached stats for the same post.
 */
import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails';
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle';
import { eq, and, desc } from 'drizzle-orm';
import dayjs from 'dayjs';

const ENTITY_TYPE = 'social_media_post_stats';

export function buildPostStatsCacheKey(postId: string, platform: string, socialAccountId: string): string {
  return `${postId}::${platform}::${socialAccountId}`;
}

export async function getPostStatsCache(
  postId: string,
  platform: string,
  socialAccountId: string
): Promise<{ id: string; details: unknown; updatedAt: Date } | null> {
  const db = useDrizzle();
  return db.query.entityDetails.findFirst({
    where: and(
      eq(entityDetails.entityId, buildPostStatsCacheKey(postId, platform, socialAccountId)),
      eq(entityDetails.entityType, ENTITY_TYPE)
    ),
    orderBy: [desc(entityDetails.updatedAt)],
  });
}

export async function savePostStatsCache(
  postId: string,
  platform: string,
  socialAccountId: string,
  details: unknown
): Promise<void> {
  const db = useDrizzle();
  const cacheKey = buildPostStatsCacheKey(postId, platform, socialAccountId);

  const existing = await db.query.entityDetails.findFirst({
    where: and(
      eq(entityDetails.entityId, cacheKey),
      eq(entityDetails.entityType, ENTITY_TYPE)
    ),
  });

  const now = dayjs().toDate();

  if (existing) {
    await db.update(entityDetails)
      .set({ details: details as Record<string, unknown>, updatedAt: now })
      .where(eq(entityDetails.id, existing.id));
  } else {
    await db.insert(entityDetails).values({
      id: crypto.randomUUID(),
      entityId: cacheKey,
      entityType: ENTITY_TYPE,
      details: details as Record<string, unknown>,
      createdAt: now,
      updatedAt: now,
    });
  }
}