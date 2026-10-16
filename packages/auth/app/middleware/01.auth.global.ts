import { stripLocalePrefix } from '#layers/BaseShared/utils/locale'

const getRouteArea = (path: string): 'app' | 'auth' | null => {
  // Locale-blind: `/es/login` is the login page too, and `/de/app/...` is
  // still the app. Matching the raw path let prefixed routes slip through —
  // logged-in users saw `/es/login` instead of being sent back to the app.
  const clean = stripLocalePrefix(path)
  if (clean.startsWith('/app')) return 'app'
  if (clean.startsWith('/login') || clean.startsWith('/register')) return 'auth'
  return null
}

const isSafeRedirectPath = (redirect: unknown): redirect is string =>
  typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')

const resumeRedirect = (redirect: unknown): string =>
  isSafeRedirectPath(redirect) ? redirect : '/app'

export default defineNuxtRouteMiddleware(async (to) => {

  const area = getRouteArea(to.path)
  if (!area) return

  // Redirect targets keep the active locale: sending a German session to a
  // bare `/app` or `/login` would resolve to the default locale (English).
  const localePath = useLocalePath()
  const { loggedIn, fetchSession } = UseUser()

  await fetchSession()

  if (!loggedIn.value) {
    if (area === 'app') return navigateTo(localePath('/login'))
    return
  }
  if (area === 'auth') return navigateTo(localePath(stripLocalePrefix(resumeRedirect(to.query.redirect))))
})
