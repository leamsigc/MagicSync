import { authClient } from "#layers/BaseAuth/lib/auth-client"
import type { User } from "#layers/BaseDB/db/auth/auth"
import type { Session } from "better-auth/types"


export default defineNuxtRouteMiddleware(async (to) => {
  // Check if the user is navigating to the app route
  const user = useState<User | null>('auth:user')
  const session = useState<Session>('auth:session')
  const isUserNavigatingToTheApp = to.path.startsWith('/app')
  const { data: loggedIn } = await authClient.useSession(useFetch)

  user.value = loggedIn.value?.user as User;
  session.value = loggedIn.value?.session as Session

  const isNavigatingToLoginOrRegister = to.path.startsWith('/login') || to.path.startsWith('/register')

  if (isUserNavigatingToTheApp && !loggedIn.value) {
    return navigateTo('/login')
  }
  if (isNavigatingToLoginOrRegister && loggedIn.value) {
    return navigateTo('/app')
  }
})
