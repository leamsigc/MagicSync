import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { notPorted } from '#ai-tools/server/utils/notPorted'

export default defineEventHandler(async (event) => {
  await checkUserIsLogin(event)
  notPorted('Research runs')
})
