import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { toolBackendsService } from '#layers/BaseDB/server/services/tool-backends.service'

const ToolBackendsSchema = z.object({
  scrapegraphApiKey: z.string().max(512).nullish(),
  langsearchApiKey: z.string().max(512).nullish(),
  pythonBackendUrl: z.string().max(512).nullish(),
  pythonBackendToken: z.string().max(512).nullish(),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = ToolBackendsSchema.parse(await readBody(event))

  const result = await toolBackendsService.save(user.id, body)
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: result.error, data: { code: result.code } })
  }
  return {
    scrapegraph: { hasKey: result.data.hasScrapegraphKey },
    langsearch: { hasKey: result.data.hasLangsearchKey },
    python: { url: result.data.pythonBackendUrl, hasToken: result.data.hasPythonToken },
  }
})
