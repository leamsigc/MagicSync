import type { User } from "#layers/BaseDB/db/auth/auth"
import type { Session } from "better-auth/types"


export default defineNuxtRouteMiddleware(async (to) => {

  const isUserNavigatingToTheApp = to.path.startsWith('/app') || to.path.startsWith('/app/')
  const isNavigatingToLoginOrRegister = to.path.startsWith('/login') || to.path.startsWith('/register')
  // console.log("Navigating:", to.fullPath);
  // console.log("App:", isUserNavigatingToTheApp);

  if (!isUserNavigatingToTheApp && !isNavigatingToLoginOrRegister) {
    return;
  }

  const { loggedIn, fetchSession } = UseUser()

  await fetchSession()

  if (isUserNavigatingToTheApp && !loggedIn.value) {
    return navigateTo('/login')
  }
  if (loggedIn.value && isNavigatingToLoginOrRegister || isNavigatingToLoginOrRegister && loggedIn.value) {
    return navigateTo('/app')
  }
})
