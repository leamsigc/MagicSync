import { authClient } from '#layers/BaseAuth/lib/auth-client'
import type { User } from '#layers/BaseDB/db/schema'
import type { Session } from 'better-auth'

const client = authClient

/**
 * A stalled session request must never freeze navigation. On timeout the
 * cached state wins (see the catch branch) and the next signal/navigation
 * retries.
 */
const SESSION_FETCH_TIMEOUT_MS = 5_000

type SessionPayload = { session: Session | null, user: User | null } | null

/** Per-nuxt-app, so SSR keeps one promise per request and the client one per tab. */
type SessionAwareNuxtApp = { _authSessionPromise?: Promise<SessionPayload> }

// Register the $sessionSignal listener exactly once per client session.
// UseUser() runs on every navigation (route middleware) and from many
// components, so subscribing inside the composable body leaks one listener
// per call. On logout better-auth flips $sessionSignal and every leaked
// listener fires fetchSession() concurrently — the request flood that
// freezes the tab on the logout click.
let sessionSignalListening = false

export function UseUser() {
  // Todo: Move to store and pinia
  const user = useState<User | null>('auth:user')
  const session = useState<Session | null>('auth:session')
  // Whether a session lookup has ever completed (success or handled failure).
  // Lets route middleware trust the SSR-hydrated payload instead of paying a
  // network round trip on every client-side navigation.
  const sessionLoaded = useState<boolean>('auth:sessionLoaded', () => false)
  const sessionCheckedAt = useState<number>('auth:sessionCheckedAt', () => 0)
  const listAccounts = useState('auth:listAccounts')
  const nuxtApp = useNuxtApp() as ReturnType<typeof useNuxtApp> & SessionAwareNuxtApp

  const clearLocalSession = () => {
    session.value = null
    user.value = null
    sessionLoaded.value = false
    sessionCheckedAt.value = 0
    clearNuxtData('auth-session')
  }

  const applySession = (data: SessionPayload) => {
    session.value = data?.session || null
    const userDefaults = {
      image: null,
      role: null,
      banReason: null,
      banned: null,
      banExpires: null,
      stripeCustomerId: null
    }
    user.value = data?.user
      ? Object.assign({}, userDefaults, data.user)
      : null
  }

  const requestSession = async (): Promise<SessionPayload> => {
    try {
      const data = await $fetch<SessionPayload>('/api/auth/get-session', {
        headers: import.meta.server ? useRequestHeaders() : undefined,
        retry: 0,
        signal: import.meta.client ? AbortSignal.timeout(SESSION_FETCH_TIMEOUT_MS) : undefined,
      } as any)
      applySession(data)
      return data
    }
    catch {
      // A transient session endpoint failure must not discard a valid hydrated
      // session or abort pages that gate on it. The next signal/navigation can
      // retry; a truly logged-out visitor still resolves with null state.
      return { session: session.value, user: user.value }
    }
    finally {
      sessionLoaded.value = true
      sessionCheckedAt.value = Date.now()
    }
  }

  // Single-flight: every caller in the same app/request shares one promise, so
  // the middleware, the $sessionSignal listener and page code can never fan out
  // into duplicate get-session requests.
  const fetchSession = (): Promise<SessionPayload> => {
    nuxtApp._authSessionPromise ??= requestSession().finally(() => {
      nuxtApp._authSessionPromise = undefined
    })
    return nuxtApp._authSessionPromise
  }

  if (import.meta.client && !sessionSignalListening) {
    sessionSignalListening = true
    client.$store.listen('$sessionSignal', async (signal) => {
      if (!signal)
        return
      await fetchSession()
    })
  }

  const getUserAccountList = async () => {
    const data = await client.listAccounts()
    listAccounts.value = data.data
  }

  return {
    session,
    user,
    sessionLoaded,
    sessionCheckedAt,
    loggedIn: computed(() => !!session.value),
    signIn: client.signIn,
    signUp: client.signUp,
    forgetPassword: client.forgetPassword,
    resetPassword: client.resetPassword,
    sendVerificationEmail: client.sendVerificationEmail,
    errorCodes: client.$ERROR_CODES,
    async signOut({ redirectTo = '/' }: { redirectTo?: string } = {}) {
      try {
        await client.signOut({
          fetchOptions: {
            onSuccess: async () => {
              clearLocalSession()
            },
            onError: async () => {
              clearLocalSession()
            }
          }
        })
      }
      finally {
        // Always leave the authenticated area: a failed sign-out request must
        // never strand the user on a dead page with no redirect.
        clearLocalSession()
        if (import.meta.client) {
          // Full reload wipes every client-side store (auth, business, caches)
          // so the next session starts clean.
          await reloadNuxtApp({ path: redirectTo })
        }
        else {
          await navigateTo(redirectTo, { replace: true })
        }
      }
    },
    client,
    getUserAccountList,
    listAccounts,
    fetchSession
  }
}
