import { z } from 'zod'
import { assetService } from '#layers/BaseShared/server/services/asset.service'

const DEFAULT_LIMIT = 200

const querySchema = z.object({
  businessId: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  mimeType: z.string().optional(),
  own: z.string().optional(),
  folderId: z.string().optional(),
})

type AssetListQuery = {
  businessId: string
  page: number
  limit: number
  mimeType?: string
  own?: string
  folderId?: string
}

function parseAssetListQuery(raw: unknown): AssetListQuery {
  const parsed = querySchema.safeParse(raw)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid asset list query' })
  }
  const { businessId, page, limit, mimeType, own, folderId } = parsed.data
  // A folder belongs to a business. Without one there is nothing to scope it to, so
  // this is a 400 — never a silent fall-through to the `own` branch.
  if (folderId !== undefined && !businessId) {
    throw createError({ statusCode: 400, statusMessage: 'folderId requires businessId' })
  }
  return {
    businessId: businessId as string,
    page: page ?? 1,
    limit: limit ?? DEFAULT_LIMIT,
    mimeType,
    own,
    folderId,
  }
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const { businessId, page, limit, mimeType, own, folderId } = parseAssetListQuery(getQuery(event))
    log.set({ businessId, pagination: { page, limit }, folderId })

    if (own === 'true') {
      log.info('Listing user assets', { userId: user.id, page, limit })
      const ownFilters = mimeType ? { mimeType } : {}
      return await assetService.findByUserId(user.id, { pagination: { page, limit }, filters: ownFilters })
    }

    const filters: Record<string, unknown> = {}
    if (mimeType) filters.mimeType = mimeType
    if (folderId !== undefined) filters.folderId = folderId

    const result = await assetService.findByBusinessId(businessId, user.id, {
      pagination: { page, limit },
      filters,
    })

    if (!result.success) {
      log.error('Failed to fetch assets', { error: result.error })
      throw createError({ statusCode: 500, statusMessage: result.error })
    }

    log.info('Assets listed successfully', { businessId, count: result.data?.length || 0 })
    return {
      success: true,
      data: result.data,
      pagination: result.pagination
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    log.error('Internal server error', { error })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})