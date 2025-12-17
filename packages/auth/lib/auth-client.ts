import type { auth } from './auth'
import { adminClient, inferAdditionalFields, genericOAuthClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), adminClient(), genericOAuthClient()]
})

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  forgetPassword,
  resetPassword,
  deleteUser,
  linkSocial,
  listAccounts,
  accountInfo,
  oauth2
} = authClient
