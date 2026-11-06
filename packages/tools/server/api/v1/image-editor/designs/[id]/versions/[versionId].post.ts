import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireDesignAuth } from '../../../../../../utils/design-auth'

/** Restore an old version of a design — replaces the live document, snapshots first. */
export default defineEventHandler(async (event) => {
  const principal = await requireDesignAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const versionId = getRouterParam(event, 'versionId') ?? ''
  const found = await designService.getVersion(id, principal.userId, versionId)
  if (!found.success || !found.data) {
    throw createError({ statusCode: 404, statusMessage: found.error ?? 'Version not found' })
  }
  const doc = (JSON.parse(found.data.content) as { doc?: unknown }).doc
  const result = await designService.update(id, principal.userId, { doc, title: found.data.title })
  if (!result.success || !result.data) {
    throw createError({ statusCode: 400, statusMessage: result.error ?? 'Failed to restore version' })
  }
  return { id: result.data.id, title: result.data.title, restoredVersion: found.data.version }
})
