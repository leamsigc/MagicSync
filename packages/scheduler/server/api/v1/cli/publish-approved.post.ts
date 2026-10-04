import { authenticateMachineRequest } from "#layers/BaseDB/server/utils/machine-auth"
import { publishingService } from "#layers/BaseDB/server/services/publishing.service"

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, 'utf8') ?? ''
  const authed = await authenticateMachineRequest(event, rawBody)
  if (!authed.success || !authed.data) {
    throw createError({ statusCode: authed.code === 'NOT_FOUND' ? 404 : 401, statusMessage: authed.error })
  }
  const { userId, body } = authed.data
  const businessId = body.businessId as string
  const connectionId = typeof body.connectionId === 'string' ? body.connectionId : ''
  const artifactId = typeof body.artifactId === 'string' ? body.artifactId : ''
  const artifactVersion = typeof body.artifactVersion === 'number' ? body.artifactVersion : 0
  if (!connectionId || !artifactId || !artifactVersion) {
    throw createError({ statusCode: 400, statusMessage: 'connectionId, artifactId, and artifactVersion are required' })
  }
  // Approval is enforced inside createJob/executeJob for the exact version.
  const created = await publishingService.createJob(userId, { businessId, connectionId, artifactId, artifactVersion }, event)
  if (!created.success || !created.data) {
    const statusCode = created.code === 'NOT_FOUND' ? 404 : 400
    throw createError({ statusCode, statusMessage: created.error })
  }
  if (created.data.duplicate) return created
  const executed = await publishingService.executeJob(userId, created.data.job.id, event)
  if (!executed.success) {
    throw createError({ statusCode: 502, statusMessage: executed.error })
  }
  return executed
})
