const getRouteArea = (path: string): 'app' | 'auth' | null => {
  if (path.startsWith('/app')) return 'app'
  if (path.startsWith('/login') || path.startsWith('/register')) return 'auth'
  return null
}

const isSafeRedirectPath = (redirect: unknown): redirect is string =>
  typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')

const resumeRedirect = (redirect: unknown): string =>
  isSafeRedirectPath(redirect) ? redirect : '/app'

export default defineNuxtRouteMiddleware(async (to) => {

  const area = getRouteArea(to.path)
  if (!area) return

  const { loggedIn, fetchSession } = UseUser()

  await fetchSession()

  if (!loggedIn.value) {
    if (area === 'app') return navigateTo('/login')
    return
  }
  if (area === 'auth') return navigateTo(resumeRedirect(to.query.redirect))
})
