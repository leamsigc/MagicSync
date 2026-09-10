import { authClient } from '#layers/BaseAuth/lib/auth-client'
import type { User } from '#layers/BaseDB/db/schema'
import type { Session } from 'better-auth'



const client = authClient

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
  const sessionFetching = import.meta.server ? ref(false) : useState('auth:sessionFetching', () => false)

  const listAccounts = useState('auth:listAccounts')

  const clearLocalSession = () => {
    session.value = null
    user.value = null
    clearNuxtData('auth-session')
  }

  const waitForInflightFetch = () => new Promise<void>((resolve) => {
    const stop = watch(sessionFetching, (fetching) => {
      if (!fetching) {
        stop()
        resolve()
      }
    })
    setTimeout(() => {
      stop()
      resolve()
    }, 15000)
  })

  const fetchSession = async () => {
    if (sessionFetching.value) {
      await waitForInflightFetch()
      return { session: session.value, user: user.value }
    }
    sessionFetching.value = true

    try {
      // Use useFetch for better SSR support and hydration
      const { data: sessionData } = await useFetch<{ session: Session, user: User }>('/api/auth/get-session', {
        headers: import.meta.server ? useRequestHeaders() : undefined,
        key: 'auth-session',
        retry: 0
      })


      const data = sessionData.value
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
      // Session fetched successfully
      return data
    }
    finally {
      sessionFetching.value = false
    }
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
