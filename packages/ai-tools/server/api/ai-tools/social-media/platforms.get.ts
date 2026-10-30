import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { CONTENT_PLATFORMS } from '#layers/BaseShared/shared/platformConstants'

/**
 * Platform catalog for content idea scans.
 *
 * The list lives in `shared/platformConstants.ts` (`CONTENT_PLATFORMS`) so the
 * scan dialog, the board picker and the publish configs agree on what
 * "supported" means — including WordPress and the smaller platforms.
 */
export default defineEventHandler(async (event) => {
  await checkUserIsLogin(event)
  return CONTENT_PLATFORMS.map(platform => ({ ...platform, limits: { ...platform } }))
})
