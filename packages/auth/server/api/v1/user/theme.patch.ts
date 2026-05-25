import { auth } from '#layers/BaseAuth/lib/auth'
import { useAuthApi } from '#layers/BaseAuth/server/utils/useAuthApi'

const VALID_THEMES = ['orange', 'ocean', 'forest', 'midnight', 'rose'] as const

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody<{ theme: string }>(event)

  if (!body.theme || !VALID_THEMES.includes(body.theme as typeof VALID_THEMES[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid theme value' })
  }

  const authApi = useAuthApi(event)
  await auth.api.updateUser({
    body: {
      userId: user.id,
      theme: body.theme,
    },
    headers: authApi.headers(),
  })

  return { success: true, theme: body.theme }
})
