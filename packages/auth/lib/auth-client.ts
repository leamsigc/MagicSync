import type { auth } from './auth'
import { adminClient, inferAdditionalFields, genericOAuthClient, organizationClient, apiKeyClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), adminClient(), genericOAuthClient(), organizationClient(), apiKeyClient()]
})

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  resetPassword,
  deleteUser,
  linkSocial,
  listAccounts,
  accountInfo,
  oauth2
} = authClient
