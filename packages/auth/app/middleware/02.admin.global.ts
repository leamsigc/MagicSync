import { authClient } from "#layers/BaseAuth/lib/auth-client"

export default defineNuxtRouteMiddleware(async (to, from) => {
  // FIXED: was 'admin' (no leading slash) — matched nothing
  // Now checks both /admin (root) and /app/admin (nested) paths
  const isUserNavigatingToAdminOnly = to.path.startsWith('/admin') || to.path.startsWith('/app/admin')
  if (!isUserNavigatingToAdminOnly) {
    return;
  }
  const { data: loggedIn } = await authClient.useSession(useFetch)
  const isUserAdmin = loggedIn.value?.user.role === 'admin'

  if (isUserNavigatingToAdminOnly && !isUserAdmin) {
    return navigateTo('/app')
  }
})
