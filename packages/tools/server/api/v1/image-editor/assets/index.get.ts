import { listDesignAssets } from '../../../../utils/design-asset-store'
import { requireDesignAuth } from '../../../../utils/design-auth'

/**
 * List stored design assets (rendered outputs, template media, stock copies).
 * Read-only: the admin page links each row to the public serve route. Access
 * needs a signed-in design user; assets themselves are non-private by design.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const principal = await requireDesignAuth(event)
  const assets = await listDesignAssets()
  const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0)
  log.set({ userId: principal.userId, count: assets.length, totalBytes })
  return {
    assets: assets.sort((a, b) => b.bytes - a.bytes),
    totalBytes,
    count: assets.length,
  }
})
