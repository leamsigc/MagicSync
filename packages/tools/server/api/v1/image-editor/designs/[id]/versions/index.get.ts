import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireDesignAuth } from '../../../../../../utils/design-auth'

/** Version history for one design (owner-only, latest 20). */
export default defineEventHandler(async (event) => {
  const principal = await requireDesignAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const result = await designService.listVersions(id, principal.userId)
  if (!result.success || !result.data) {
    throw createError({ statusCode: 500, statusMessage: result.error ?? 'Failed to list versions' })
  }
  return { id, versions: result.data.map(row => ({ id: row.id, version: row.version, title: row.title, createdAt: row.createdAt })) }
})
