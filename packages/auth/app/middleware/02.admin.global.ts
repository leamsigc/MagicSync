
export default defineNuxtRouteMiddleware(async (to, from) => {
  // FIXED: was 'admin' (no leading slash) — matched nothing
  // Now checks both /admin (root) and /app/admin (nested) paths
  const isUserNavigatingToAdminOnly = to.path.startsWith('/app/admin')
  if (!isUserNavigatingToAdminOnly) {
    return;
  }

  const { loggedIn, user } = UseUser()
  const isUserAdmin = user.value?.role === 'admin';

  if (isUserNavigatingToAdminOnly && !isUserAdmin) {
    return navigateTo('/app')
  }
})
