import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { resolveGithubToken } from '#layers/BaseScheduler/server/utils/github-oauth'

interface GithubRepo {
  fullName: string
  defaultBranch: string
  private: boolean
  updatedAt: string | null
}

const PER_PAGE = 100
const MAX_PAGES = 3

/**
 * GET /api/v1/publishing/github/repos
 *
 * Netlify-style repository picker: uses the user's connected GitHub account to
 * list the repositories they can push to. `connected:false` tells the UI to
 * offer the "Connect GitHub" flow instead of an empty picker.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const token = await resolveGithubToken(event, user.id)

  if (!token) {
    return { connected: false, repos: [] as GithubRepo[], reason: 'NOT_CONNECTED' }
  }

  const repos: GithubRepo[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetch(
      `https://api.github.com/user/repos?per_page=${PER_PAGE}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'MagicSync',
        },
      },
    )

    if (response.status === 401) {
      log.warn({ message: 'GitHub repo list rejected the token' })
      return { connected: false, repos: [] as GithubRepo[], reason: 'REAUTH_REQUIRED' }
    }
    if (!response.ok) {
      log.error({ message: 'GitHub repo list failed', status: response.status })
      throw createError({ statusCode: 502, statusMessage: 'Could not list GitHub repositories' })
    }

    const batch = await response.json() as Array<{
      full_name?: string
      default_branch?: string
      private?: boolean
      updated_at?: string
    }>
    for (const repo of batch) {
      if (!repo.full_name) continue
      repos.push({
        fullName: repo.full_name,
        defaultBranch: repo.default_branch || 'main',
        private: Boolean(repo.private),
        updatedAt: repo.updated_at ?? null,
      })
    }
    if (batch.length < PER_PAGE) break
  }

  log.info({ message: 'GitHub repositories listed', count: repos.length })
  return { connected: true, repos }
})
