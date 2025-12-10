import type { RouteLocationRaw } from 'vue-router'
import { authClient } from '#layers/BaseAuth/lib/auth-client'
import type { User } from '#layers/BaseDB/db/schema'
import type { Session } from 'better-auth'



const client = authClient

export function UseUser() {

  // Todo: Move to store and pinia
  const user = useState<User | null>('auth:user')
  const session = useState<Session | null>('auth:session')
  const sessionFetching = import.meta.server ? ref(false) : useState('auth:sessionFetching', () => false)
  const headers = import.meta.server ? useRequestHeaders() : undefined

  const listAccounts = useState('auth:listAccounts')

  const fetchSession = async () => {
    if (sessionFetching.value) {
      return
    }
    sessionFetching.value = true

    // Use useFetch for better SSR support and hydration
    const { data: sessionData } = await useFetch<{ session: Session, user: User }>('/api/auth/get-session', {
      headers: import.meta.server ? useRequestHeaders() : undefined,
      key: 'auth-session',
      retry: 0
    })


    const data = sessionData.value
    session.value = data?.session || null
    console.log("Fetched session");
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
    sessionFetching.value = false
    return data
  }

  if (import.meta.client) {
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
    async signOut({ redirectTo }: { redirectTo?: RouteLocationRaw } = {}) {
      await client.signOut({
        fetchOptions: {
          onSuccess: async () => {
            session.value = null
            user.value = null
            if (redirectTo) {
              await reloadNuxtApp({
                path: redirectTo.toString()
              })
            }
          }
        }
      })
    },
    client,
    getUserAccountList,
    listAccounts,
    fetchSession
  }
}
