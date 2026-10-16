
import { stripLocalePrefix } from '#layers/BaseShared/utils/locale'

export default defineNuxtRouteMiddleware(async (to, from) => {
  // FIXED: was 'admin' (no leading slash) — matched nothing
  // Now checks both /admin (root) and /app/admin (nested) paths
  // Locale-blind: `/de/app/admin` is the admin area too.
  const isUserNavigatingToAdminOnly = stripLocalePrefix(to.path).startsWith('/app/admin')
  if (!isUserNavigatingToAdminOnly) {
    return;
  }

  const { loggedIn, user } = UseUser()
  const isUserAdmin = user.value?.role === 'admin';

  if (isUserNavigatingToAdminOnly && !isUserAdmin) {
    return navigateTo(useLocalePath()('/app'))
  }
})
