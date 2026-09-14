import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { toolBackendsService } from '#layers/BaseDB/server/services/tool-backends.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const result = await toolBackendsService.get(user.id)
  if (!result.success) throw createError({ statusCode: 500, statusMessage: result.error })
  return {
    scrapegraph: { hasKey: result.data.hasScrapegraphKey },
    langsearch: { hasKey: result.data.hasLangsearchKey },
    python: { url: result.data.pythonBackendUrl, hasToken: result.data.hasPythonToken },
  }
})
