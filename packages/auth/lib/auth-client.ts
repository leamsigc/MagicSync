import type { auth } from './auth'
import { apiKeyClient } from "@better-auth/api-key/client"
import { adminClient, inferAdditionalFields, genericOAuthClient, organizationClient, } from 'better-auth/client/plugins'
import { createAuthClient } from "better-auth/client"

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
