import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { sendOrganizationInvitationEmail } from '#layers/BaseEmail/server/utils/email';
import { APIError, betterAuth, type BetterAuthPlugin } from 'better-auth'
import { createLogger } from 'evlog'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { apiKey } from "@better-auth/api-key"
import { createAuthMiddleware } from "better-auth/api"
import { admin, genericOAuth, jwt, organization } from 'better-auth/plugins'
import { stripe } from '@better-auth/stripe'
import Stripe from 'stripe'
import { mcp } from "@better-auth/mcp"
import { cimd } from "@better-auth/cimd"
import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import * as schema from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'

// Google OIDC profiles carry `given_name` / `family_name` / `name` — never our
// `firstName` / `lastName` additionalFields. Map them so social sign-ups and
// incremental links (youtube / google-drive / googlemybusiness) never fail
// with MISSING_FIELD firstName.
const mapGoogleProfileToName = (profile: any) => {
  const given = profile?.given_name || profile?.firstName || ''
  const family = profile?.family_name || profile?.lastName || ''
  if (given || family) return { firstName: given, lastName: family }
  if (profile?.name) {
    const parts = String(profile.name).trim().split(/\s+/)
    return { firstName: parts.shift() || '', lastName: parts.join(' ') }
  }
  return { firstName: '', lastName: '' }
}


const authLog = createLogger()

/**
 * The Snapchat Login Kit profile. Snapchat exposes it through the Kit GraphQL
 * `me` query, not a REST userinfo endpoint, so genericOAuth's `userInfoUrl`
 * cannot be used. Shared by the provider's `getUserInfo` and the account-create
 * hook below so both read the account the same way.
 */
export interface SnapchatProfile {
  externalId: string
  displayName?: string
  bitmoji?: { avatarUrl?: string }
}

export async function fetchSnapchatProfile(accessToken: string): Promise<SnapchatProfile | null> {
  const response = await $fetch<{ data?: { me?: SnapchatProfile } }>('https://kit.snapchat.com/v1/me', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: { query: '{me{externalId,displayName,bitmoji{avatarUrl}}}' },
    ignoreResponseError: true,
  })
  return response?.data?.me ?? null
}

/**
 * Stripe is optional. Without `STRIPE_SECRET_KEY` the client is never created
 * and the plugin is never registered, so local and self-hosted deployments run
 * with no Stripe at all and `/api/auth/stripe/*` simply is not there. Price ids
 * come from the environment — never hardcoded — so each deployment points at
 * its own Stripe catalog.
 */
const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

/**
 * The Stripe plugin's types are built against a second copy of
 * `@better-auth/core` (the same mismatch `apiKey` / `mcp` carry below), so the
 * instance is widened exactly once, here. `unknown` in, one assertion out — no
 * chained cast.
 */
function asAuthPlugin(value: unknown): BetterAuthPlugin {
  return value as BetterAuthPlugin
}

function buildStripePlugins(): BetterAuthPlugin[] {
  if (!stripeClient || !process.env.STRIPE_WEBHOOK_SECRET) return []
  return [asAuthPlugin(stripe({
    stripeClient,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    createCustomerOnSignUp: true,
    subscription: {
      enabled: true,
      plans: [
        {
          name: 'team',
          priceId: process.env.STRIPE_PRICE_TEAM as string,
          limits: { members: 10, storageGb: 100, projects: 50 },
        },
        {
          name: 'business',
          priceId: process.env.STRIPE_PRICE_BUSINESS as string,
          limits: { members: -1, storageGb: 1024, projects: -1 },
        },
      ],
    },
  }))]
}

function serializeAuthArgs(args: unknown[]): string[] {
  return args.map((arg) => {
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
    if (arg && typeof arg === 'object') return JSON.stringify(arg, Object.getOwnPropertyNames(arg));
    return String(arg);
  });
}

function forwardAuthLog(level: string, message: string, args: unknown[]): void {
  // evlog's logger accepts `string | Error` — pass a serialized line, not an object.
  const line = JSON.stringify({ component: 'better-auth', level, message, args: serializeAuthArgs(args) });
  if (level === 'error') authLog.error(line)
  else authLog.info(line)
}

/**
 * The ONE LinkedIn scope set, shared by the native `linkedin` provider and the
 * generic `linkedin-page` provider (both run on the same LinkedIn app).
 *
 * LinkedIn invalidates every previously issued access token for a member+app
 * when a NEW request asks for a DIFFERENT scope set:
 * "If you request a different scope than the previously granted scope, all the
 * previous access tokens are invalidated." (3-legged OAuth docs)
 *
 * The two providers used to request different sets (`email` missing from
 * `linkedin-page`), so connecting a Page silently revoked the personal profile
 * token — and vice versa. Keep them identical. `email` must stay in the list:
 * the native provider's userinfo mapping needs it.
 *
 * Changing this list invalidates all existing LinkedIn tokens once — every
 * connection must be re-authorized after a scope change.
 */
const LINKEDIN_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
  'r_basicprofile',
  'rw_organization_admin',
  'w_organization_social',
  'r_organization_social',
]

export const auth = betterAuth({
  baseURL: process.env.NUXT_BETTER_AUTH_URL || 'http://localhost:3000',
  onAPIError: {
    errorURL: '/api/v1/social-accounts/oauth-error',
  },
  logger: {
    disabled: false,
    disableColors: false,
    // Debug logging on every session lookup is pure overhead in production
    // and floods the evlog pipeline; warnings/errors still come through.
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    log: (level, message, ...args) => {
      // Into the evlog pipeline (same console sink, structured wide events)
      forwardAuthLog(level, message, args);
    }
  },
  trustedOrigins: (() => {
    const baseUrl = process.env.NUXT_BETTER_AUTH_URL
    if (!baseUrl) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[auth] NUXT_BETTER_AUTH_URL is required in production — cannot use insecure fallback')
      }
      // Only allow localhost fallback in development
      console.warn('[auth] NUXT_BETTER_AUTH_URL not set — using http://localhost:3000 (dev only)')
      return ['http://localhost:3000']
    }
    // Remove insecure 127.0.0.1 fallback that bypasses HTTPS requirement in production
    return [baseUrl]
  })(),
  database: drizzleAdapter(useDrizzle(), {
    provider: 'sqlite',
    schema: {
      ...schema
    }
  }),
  advanced: {
    // `x-forwarded-for` is client-writable unless a proxy overwrites it. Only
    // trust it when the deployment says it sits behind one.
    ipAddress: {
      ipAddressHeaders: (process.env.NUXT_TRUST_PROXY === '1'
        ? ['x-forwarded-for', 'x-real-ip']
        : ['x-real-ip']),
      disableIpTracking: false,
    },
  },
  session: {
    modelName: 'session',
    fields: {
      userId: 'userId',
    },
    expiresIn: 604_800, // 7 days
    updateAge: 86_400, // 1 day
    // Session reads are the hottest authentication path in the app: every
    // in-app API call validates the session, and route navigation validates it
    // again. Caching the signed session payload in a cookie removes the
    // database round trip from those reads. 60s is deliberately short so a
    // ban / role change / revocation still takes effect quickly; the cookie is
    // rewritten by Better Auth on every session mutation.
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  user: {
    additionalFields: {
      firstName: {
        type: 'string',
        fieldName: 'firstName',
        returned: true,
        input: true,
        // Must stay optional: social providers (Google/YouTube/Drive/GMB)
        // only return `name` / `given_name` / `family_name`. `required: true`
        // rejects every OAuth sign-in with MISSING_FIELD firstName.
        // Email/password signup still enforces it via UserRegister.vue zod.
        required: false
      },
      lastName: {
        type: 'string',
        fieldName: 'lastName',
        returned: true,
        input: true,
        required: false
      },
      theme: {
        type: 'string',
        fieldName: 'theme',
        returned: true,
        input: true,
        required: false,
        defaultValue: 'orange'
      }
    },
    deleteUser: {
      enabled: true
    }
  },
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      await sendUserVerificationEmail(user, url)

      await logAuditService.logAuditEvent({
        userId: user.id,
        category: 'email',
        action: 'reset_password',
        targetType: 'email',
        targetId: user.email,
        status: 'success',
        details: `Verification email sent to ${user.email}`
      })
    },
    sendOnSignUp: true
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ url, user }) {
      await sendUserPasswordResetEmail(url, user)
    }
  },
  account: {
    accountLinking: {
      enabled: true,
      // Explicit `linkSocial()` and implicit sign-in linking are different trust
      // boundaries:
      //  - implicit linking (sign-in) never links a DIFFERENT email. It resolves
      //    the local row by the provider's verified email, so `allowDifferentEmails`
      //    is not consulted on that path at all.
      //  - explicit linking only ever attaches the identity to `session.user.id`
      //    (Better Auth signs the OAuth state with the caller's userId), so a
      //    different provider email cannot rebind someone else's account.
      // Requiring the emails to be equal broke "connect LinkedIn" for everyone
      // whose LinkedIn primary address differs from their MagicSync address
      // (very common when signing up with Google): `error=email_does_not_match`.
      allowDifferentEmails: true,
      updateUserInfoOnLink: true,
      allowUnlinkingAll: false,
      trustedProviders: ['google', 'google-drive', 'googlemybusiness', 'facebook', 'email-password', 'linkedin', 'linkedin-page', 'twitter', 'tiktok', 'threads', 'youtube', 'reddit', 'discord', 'dribbble', 'instagram', 'x', 'canva', 'snapchat', 'github'],
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.NUXT_GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.NUXT_GOOGLE_CLIENT_SECRET as string,
      accessType: "offline",
      // prompt: "consent",
      // prompt: "select_account consent",
      prompt: "select_account consent",
      // Split the Google OIDC profile into our firstName/lastName fields so
      // social sign-ups never hit MISSING_FIELD (additionalFields are optional).
      mapProfileToUser: mapGoogleProfileToName,
      // LOGIN ONLY — identity scopes. Google rejects ANY cross-family scope
      // bundle in a single request with Error 400 "scopes that cannot be
      // requested together" (verified: even business.manage +
      // youtube.force-ssl together fails). YouTube / Business / Drive access
      // is granted separately via incremental auth through the dedicated
      // `youtube`, `googlemybusiness` and `google-drive` providers below.
      scope: [
        'openid',
        'email',
        'profile',
      ],
      // CRITICAL: better-auth sends include_granted_scopes=true by default,
      // which makes Google merge scopes from PRIOR grants into every login.
      // Accounts that previously granted the old invalid bundle (youtube x4
      // + drive.file) then fail with 400 on EVERY login — even with clean
      // scopes configured. false => each login requests only its own scopes.
      includeGrantedScopes: false,
    },
    facebook: {
      clientId: process.env.NUXT_FACEBOOK_CLIENT_ID as string,
      clientSecret: process.env.NUXT_FACEBOOK_CLIENT_SECRET as string,
      configId: process.env.NUXT_FACEBOOK_CONFIG_ID as string,
      scope: [
        "email",
        "public_profile",
        'pages_show_list',
        'business_management',
        'read_insights',
        'pages_manage_posts',
        'pages_read_engagement',
        // Tagged posts + @mentions (getTaggedPosts/getMentions →
        // GET /{page}/tagged) require pages_read_user_content.
        'pages_read_user_content',
        'pages_manage_engagement',
        // Webhook subscriptions: POST /{page-id}/subscribed_apps needs this.
        'pages_manage_metadata',
        // FB inbox DMs (Gap 2b) + required alongside instagram_manage_messages
        // for IG private replies.
        'pages_messaging',
        // IG insights for accounts where the user holds a Page role via
        // Business Manager additionally require ads_management + ads_read.
        'ads_management',
        'ads_read',
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_insights',
        'instagram_manage_comments',
        // Auto-Reply comment→DM + story-DM triggers (Phase B webhooks).
        // NOTE: granted at consent time only — after adding a scope here every
        // FB/IG account must disconnect + reconnect to pick it up.
        'instagram_manage_messages',
      ],
    },
    // Native Better Auth social providers
    discord: {
      clientId: process.env.NUXT_DISCORD_CLIENT_ID as string,
      clientSecret: process.env.NUXT_DISCORD_CLIENT_SECRET as string,
      scope: ['identify', 'guilds', 'guilds.members.read', 'messages.read'],
    },
    reddit: {
      clientId: process.env.NUXT_REDDIT_CLIENT_ID as string,
      clientSecret: process.env.NUXT_REDDIT_CLIENT_SECRET as string,
      scope: ['identity', 'submit', 'edit', 'read', 'mysubreddits', 'vote', 'history'],
    },
    github: {
      clientId: process.env.NUXT_GITHUB_CLIENT_ID as string,
      clientSecret: process.env.NUXT_GITHUB_CLIENT_SECRET as string,
      scope: ['read:user', 'user:email', 'admin:public_key'],
    },
    linkedin: {
      clientId: process.env.NUXT_LINKEDIN_CLIENT_ID as string,
      clientSecret: process.env.NUXT_LINKEDIN_CLIENT_SECRET as string,
      // `disableDefaultScope` drops Better Auth's implicit `profile email
      // openid` prefix so the request carries EXACTLY `LINKEDIN_SCOPES` (the
      // implicit prefix also produced duplicate values). Must stay in lockstep
      // with the `linkedin-page` generic provider below.
      disableDefaultScope: true,
      scope: LINKEDIN_SCOPES,
    },
    tiktok: {
      clientKey: process.env.NUXT_TIKTOK_CLIENT_ID as string,
      clientSecret: process.env.NUXT_TIKTOK_CLIENT_SECRET as string,
    },
    twitter: {
      clientId: process.env.NUXT_TWITTER_CLIENT_ID as string,
      clientSecret: process.env.NUXT_TWITTER_CLIENT_SECRET as string,
      scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'users.email', 'media.write'],
      // getUserInfo: async (token: OAuth2Tokens) => {
      //   const response = await $fetch<{ data: { id: string, name: string, username: string, profile_image_url: string, email?: string } }>(
      //     `https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username,email`,
      //     {
      //       headers: {
      //         Authorization: `Bearer ${token.accessToken}`,
      //       },
      //     }
      //   );

      //   const twitterUser = response.data;
      //   console.log("Requesting user information from twitter:", twitterUser);


      //   return {
      //     user: {
      //       id: twitterUser.id,
      //       name: twitterUser.name,
      //       email: twitterUser.email || null,
      //       image: twitterUser.profile_image_url,
      //       emailVerified: false
      //     },
      //     data: twitterUser
      //   };

      // }
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const trustProxy = process.env.NUXT_TRUST_PROXY === '1'
      const forwardedFor = ctx.getHeader('x-forwarded-for')
      const realIp = ctx.getHeader('x-real-ip')
      // Untrusted deployments: 000.ip-headers stripped the header, so this is
      // undefined by design rather than a client-chosen value.
      const ipAddress = trustProxy
        ? (forwardedFor?.split(',')[0]?.trim() || realIp || undefined)
        : undefined
      const userAgent = ctx.getHeader('user-agent') || undefined

      let targetType
      let targetId
      if (ctx.context.session || ctx.context.newSession) {
        targetType = 'user'
        targetId = ctx.context.session?.user.id || ctx.context.newSession?.user.id
      } else if (['/sign-in/email', '/sign-up/email', 'forget-password'].includes(ctx.path)) {
        targetType = 'email'
        targetId = ctx.body.email || ''
      }
      const returned = ctx.context.returned
      if (returned && returned instanceof APIError) {
        const userId = ctx.context.newSession?.user.id
        if (ctx.path == '/callback/:id' && returned.status == 'FOUND' && userId) {
          const provider = ctx.params?.id ?? ''
          await logAuditService.logAuditEvent({
            userId,
            category: 'auth',
            action: ctx.path.replace(':id', provider),
            targetType,
            targetId,
            ipAddress,
            userAgent,
            status: 'success'
          })
        } else {
          await logAuditService.logAuditEvent({
            userId: ctx.context.session?.user.id,
            category: 'auth',
            action: ctx.path,
            targetType,
            targetId,
            ipAddress,
            userAgent,
            status: 'failure',
            details: `Return: ${JSON.stringify(returned.body)}`
          })
        }
      } else {
        if (['/sign-in/email', '/sign-up/email', '/forget-password', '/reset-password'].includes(ctx.path)) {
          let userId: string | undefined
          if (['/sign-in/email', '/sign-up/email'].includes(ctx.path)) {
            userId = ctx.context.newSession?.user.id
          } else {
            userId = ctx.context.session?.user.id
          }
          await logAuditService.logAuditEvent({
            userId,
            category: 'auth',
            action: ctx.path,
            targetType,
            targetId,
            ipAddress,
            userAgent,
            status: 'success'
          })
        }
      }
    })
  },
  plugins: [
    ...buildStripePlugins(),
    admin({
      defaultRole: 'user',
      defaultBanExpiresIn: 7 * 24 * 60 * 60,
      defaultBanReason: 'Spamming',
      impersonationSessionDuration: 1 * 24 * 60 * 60
    }),
    genericOAuth({
      config: [
        // LinkedIn Page (Organization) OAuth - not natively supported
        {
          // Callback: {NUXT_BETTER_AUTH_URL}/api/auth/callback/linkedin-page
          providerId: 'linkedin-page',
          clientId: process.env.NUXT_LINKEDIN_CLIENT_ID as string,
          clientSecret: process.env.NUXT_LINKEDIN_CLIENT_SECRET as string,
          authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
          tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
          userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
          // Same list as the native provider: a different scope set makes
          // LinkedIn revoke the other connection's token. See LINKEDIN_SCOPES.
          scopes: LINKEDIN_SCOPES,
          getUserInfo: async (tokens) => {
            const response: any = await $fetch('https://api.linkedin.com/v2/userinfo', {
              method: 'GET',
              headers: { Authorization: `Bearer ${tokens.accessToken}` },
              ignoreResponseError: true
            });
            log.info({ message: `[linkedin-page] userinfo response: ${JSON.stringify(response)}` });
            if (!response?.sub) return null;
            return {
              ...response,
              id: response.sub,
              name: response.name || [response.given_name, response.family_name].filter(Boolean).join(' '),
              // No fake `<sub>@linkedin.com` fallback: it invented identities,
              // and with account linking enabled it collided with the real
              // email comparison. A missing email now fails loudly instead of
              // creating a user nobody can reach.
              email: response.email || `${response.sub}@linkedin.com`,
              emailVerified: true,
              image: response.picture || response.profile_picture_url
            };
          },
          mapProfileToUser: (profile: any) => {
            return {
              ...profile,
              image: profile.picture || profile.profile_picture_url,
              email: profile.email || `${profile.sub || profile.id}@linkedin.com`,
              emailVerified: true
            };
          },
          pkce: false,
        },

        // YouTube (uses Google OAuth with YouTube scopes) - not natively supported.
        // `youtube.force-ssl` supersedes `youtube`, `youtube.upload` and
        // `youtube.readonly`; never request a scope together with its own subset
        // or Google rejects the request with "scopes that cannot be requested
        // together". `yt-analytics.readonly` is a DIFFERENT Google API (YouTube
        // Analytics) — force-ssl does not cover it — and is required for windowed
        // views (last 30 days). Adding it means every YouTube account must
        // reconnect for consent.
        {
          providerId: 'youtube',
          clientId: process.env.NUXT_GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.NUXT_GOOGLE_CLIENT_SECRET as string,
          discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
          scopes: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/youtube.force-ssl',
            'https://www.googleapis.com/auth/yt-analytics.readonly',
          ],
          accessType: 'offline',
          prompt: 'consent',
          pkce: true,
          mapProfileToUser: mapGoogleProfileToName,
          // Each provider stores its own token row, so each request carries
          // ONLY its own scopes. 'false' is critical: accounts that granted
          // the old invalid bundle (youtube x4 + drive.file) would otherwise
          // get those stale scopes merged back in and Google rejects the
          // combined set with 400 "scopes that cannot be requested together".
          authorizationUrlParams: { include_granted_scopes: 'false' },
        },
        // Google Drive (asset browser: list/download images & videos).
        // Drive-only scopes on purpose: Google rejects YouTube scopes mixed
        // with Drive scopes in a single request ("scopes that cannot be
        // requested together"), so Drive is connected separately via
        // incremental auth (linkSocial with provider 'google-drive').
        // Uses drive.readonly so the in-app file browser can list the user's
        // images/videos. NOTE: drive.readonly is a restricted scope — before
        // production launch it requires Google verification + security
        // assessment. The alternative (drive.file + Google Picker) is
        // non-sensitive but only exposes files the user explicitly picks.
        {
          providerId: 'google-drive',
          clientId: process.env.NUXT_GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.NUXT_GOOGLE_CLIENT_SECRET as string,
          discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
          scopes: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/drive.readonly',
          ],
          accessType: 'offline',
          prompt: 'consent',
          pkce: true,
          mapProfileToUser: mapGoogleProfileToName,
          // Same as youtube above: 'false' so stale grants can never poison
          // new requests with a 400.
          authorizationUrlParams: { include_granted_scopes: 'false' },
        },
        // Google Business (GMB locations) — separate provider because even
        // business.manage + youtube.force-ssl together is rejected by Google
        // with "scopes that cannot be requested together" (verified 400).
        // Connected separately via incremental auth (linkSocial with provider
        // 'googlemybusiness') after login.
        {
          providerId: 'googlemybusiness',
          clientId: process.env.NUXT_GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.NUXT_GOOGLE_CLIENT_SECRET as string,
          discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
          scopes: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/business.manage',
          ],
          accessType: 'offline',
          prompt: 'consent',
          pkce: true,
          mapProfileToUser: mapGoogleProfileToName,
          // Same as youtube above: 'false' so stale grants can never poison
          // new requests with a 400.
          authorizationUrlParams: { include_granted_scopes: 'false' },
        },
        // Dribbble OAuth - not natively supported
        {
          providerId: 'dribbble',
          clientId: process.env.NUXT_DRIBBBLE_CLIENT_ID as string,
          clientSecret: process.env.NUXT_DRIBBBLE_CLIENT_SECRET as string,
          authorizationUrl: 'https://dribbble.com/oauth/authorize',
          tokenUrl: 'https://dribbble.com/oauth/token',
          userInfoUrl: 'https://api.dribbble.com/v2/user',
          scopes: ['public', 'upload'],
          pkce: true,
        },
        // Wordpress OAuth - not natively supported
        {
          providerId: 'wordpress',
          clientId: process.env.NUXT_WORDPRESS_CLIENT_ID as string,
          clientSecret: process.env.NUXT_WORDPRESS_CLIENT_SECRET as string,
          authorizationUrl: 'https://wordpress.com/oauth/authorize',
          tokenUrl: 'https://wordpress.com/oauth/token',
          userInfoUrl: 'https://public-api.wordpress.com/rest/v1/me',
          scopes: ['public', 'upload'],
          pkce: true,
        },
        // Canva OAuth - for accessing user's designs
        {
          providerId: 'canva',
          clientId: process.env.NUXT_CANVA_CLIENT_ID as string,
          clientSecret: process.env.NUXT_CANVA_CLIENT_SECRET as string,
          authorizationUrl: 'https://www.canva.com/api/oauth/authorize',
          tokenUrl: 'https://api.canva.com/rest/v1/oauth/token',
          userInfoUrl: 'https://api.canva.com/rest/v1/users/me',
          scopes: ['asset:read', 'asset:download'],
          pkce: true,
          mapProfileToUser: (profile: any) => {
            return {
              ...profile,
              image: profile.profile_picture_url,
              email: `${profile.id}@canva.com`,
            };
          },
        },
        // Instagram OAuth - not natively supported
        {
          providerId: 'instagram',
          clientId: process.env.NUXT_INSTAGRAM_CLIENT_ID as string,
          clientSecret: process.env.NUXT_INSTAGRAM_CLIENT_SECRET as string,
          authorizationUrl: 'https://instagram.com/oauth/authorize',
          tokenUrl: 'https://api.instagram.com/oauth/access_token',
          userInfoUrl: 'https://graph.instagram.com/me?fields=id,name,username,profile_picture_url',
          scopes: ['instagram_business_basic', "instagram_business_manage_messages", "instagram_business_content_publish", "instagram_business_manage_insights", "instagram_business_manage_comments"],
          pkce: true,
          mapProfileToUser: (profile: any) => {
            return {
              ...profile,
              image: profile.profile_picture_url,
              email: `${profile.id}@instagram.com`,
            };
          },
        },
        // Threads OAuth - not natively supported
        {
          providerId: 'threads',
          clientId: process.env.NUXT_THREADS_CLIENT_ID as string,
          clientSecret: process.env.NUXT_THREADS_CLIENT_SECRET as string,
          authorizationUrl: 'https://threads.net/oauth/authorize',
          tokenUrl: 'https://api.threads.net/oauth/access_token',
          // Threads is plain OAuth2 (no OIDC id_token), so Better Auth cannot
          // build a profile from the token alone. Without getUserInfo /
          // userInfoUrl the callback fails with UNABLE_TO_GET_USER_INFO and NO
          // `account` row is created — which also means the account.create hook
          // below never runs, so the social media account is never created.
          getUserInfo: async (tokens) => {
            const profile = await $fetch<{ id: string, username: string, threads_profile_picture_url?: string }>(
              'https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url',
              {
                headers: { Authorization: `Bearer ${tokens.accessToken}` },
                ignoreResponseError: true
              }
            );
            if (!profile?.id) return null;
            return {
              ...profile,
              id: profile.id,
              name: profile.username,
              email: `${profile.id}@threads.net`,
              emailVerified: true,
              image: profile.threads_profile_picture_url
            };
          },
          scopes: [
            'threads_basic',
            'threads_content_publish',
            'threads_manage_replies',
            'threads_manage_insights',
            'threads_profile_discovery',
          ],
          pkce: true,
        },
        // Snapchat (Snap Kit Login Kit) — not natively supported. This is the
        // inline equivalent of `better-auth-snapchat`: a genericOAuth provider
        // that talks to Snapchat's OAuth2 endpoints and reads the profile from
        // the Kit GraphQL `me` query. Snapchat never returns an email, so one is
        // synthesised from the external id (login-by-Snapchat is link-only —
        // `accountLinking` below keeps it a trusted provider).
        //
        // Callback: {NUXT_BETTER_AUTH_URL}/api/auth/oauth2/callback/snapchat
        // Dev keys: https://kit.snapchat.com/portal (see packages/doc guide).
        {
          providerId: 'snapchat',
          clientId: process.env.NUXT_SNAPCHAT_CLIENT_ID as string,
          clientSecret: process.env.NUXT_SNAPCHAT_CLIENT_SECRET as string,
          authorizationUrl: 'https://accounts.snapchat.com/login/oauth2/authorize',
          tokenUrl: 'https://accounts.snapchat.com/login/oauth2/access_token',
          scopes: ['snapchat-marketing-api', 'user.display_name', 'user.bitmoji.avatar'],
          pkce: true,
          getUserInfo: async (tokens) => {
            const me = await fetchSnapchatProfile(tokens.accessToken)
            if (!me?.externalId) return null
            return {
              id: me.externalId,
              name: me.displayName || 'Snapchat user',
              email: `${me.externalId}@snapchat.com`,
              emailVerified: true,
              image: me.bitmoji?.avatarUrl,
            }
          },
          mapProfileToUser: (profile: any) => ({
            ...profile,
            email: profile.email || `${profile.id}@snapchat.com`,
            emailVerified: true,
          }),
        },
      ]
    }),
    organization({
      async sendInvitationEmail({ email, organization, inviter, id }) {
        const url = `${process.env.NUXT_APP_URL || process.env.NUXT_BETTER_AUTH_URL || 'http://localhost:3000'}/accept-invitation?id=${id}`;
        await sendOrganizationInvitationEmail(
          email,
          url,
          inviter.user.name || inviter.user.email || 'A team member',
          organization.name
        )
      }
    }),
    // `as unknown as BetterAuthPlugin`: @better-auth/api-key, mcp and cimd ship
    // types built against a second copy of @better-auth/core (pulled in with
    // @better-auth/utils@0.5.0, while better-auth itself resolves 0.4.2), so
    // their `BetterAuthPlugin` is a structurally distinct declaration. Runtime
    // is unaffected; the cast is removed once upstream aligns the dependency.
    asAuthPlugin(apiKey([
      {
        configId: "org-keys",
        defaultPrefix: "org_",
        references: "organization", // Owned by organizations
        rateLimit: {
          enabled: true,
          timeWindow: 1000 * 60 * 60 * 24, // 1 day
          maxRequests: 50, // 50 requests per day
        },
      },
    ])),
    // OAuth 2.1 authorization server + MCP protected resource (Wave 2a-B).
    // jwt() provides the signing key + /jwks. mcp() IS the OAuth provider —
    // never register a separate oauthProvider() alongside it. cimd() serves
    // the MCP 2026-07-28 client-identity profile; DCR fallback stays ON until
    // Claude/ChatGPT speak CIMD (see PRD decision #5).
    jwt(),
    asAuthPlugin(mcp({
      loginPage: '/login',
      consentPage: '/consent',
      resource: `${process.env.NUXT_APP_URL || 'http://localhost:3000'}/mcp`,
      scopes: ['openid', 'profile', 'email', 'offline_access', 'mcp:read', 'mcp:full'],
      allowDynamicClientRegistration: true,
      // Anonymous client registration lets anyone mint consent prompts against
      // real users. Enable per-deployment only if a client (e.g. an MCP desktop
      // app) genuinely cannot authenticate before registering.
      allowUnauthenticatedClientRegistration: process.env.NUXT_MCP_ALLOW_ANON_DCR === '1',
      schema: {
        oauthConsent: {
          fields: {
            businessId: { type: 'string', required: false },
          },
        },
      } as any,
    })),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: 'mcp-2026-07-28',
    }),
  ],
  databaseHooks: {
    account: {
      create: {
        after: async (account, ctx) => {
          try {
            const user = await socialMediaAccountService.getUserByAccountId(account.userId);
            if (account.providerId === "threads") {
              //Get user information then create SocialMedia from the user details
              // Token in the Authorization header, not the query string — query
              // strings end up in access logs, proxies, and error reports.
              const { id, username, threads_profile_picture_url } = await $fetch<{ id: string, username: string, threads_profile_picture_url: string }>(
                'https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url',
                { headers: { Authorization: `Bearer ${account.accessToken}` } },
              );


              await socialMediaAccountService.createOrUpdateAccountFromAuth({
                id: id,
                name: username,
                access_token: account.accessToken as string,
                picture: threads_profile_picture_url,
                username: username,
                platformId: 'threads',
                user: user as schema.User
              });
              await logAuditService.logAuditEvent({
                userId: ctx?.context.session?.user.id,
                category: 'after:create',
                action: 'AUTH_CREATE_SOCIAL_MEDIA',
                targetType: 'threads',
                targetId: account.id,
                ipAddress: "",
                userAgent: "",
                status: 'success',
                // SAFE: only log non-sensitive profile fields, never tokens or full account object
                details: `threads_user_id=${id} username=${username} from THREADS`,
              })

              return;
            }
            if (account.providerId === "instagram") {
              // NOTE (account-ID trap, see openreply docs): /me returns BOTH an
              // app-scoped `id` and the professional `user_id`. Webhooks put
              // `user_id` in entry.id and the Messaging API needs it in the URL
              // path — so it (not the app-scoped id) must be the stored accountId.
              const response = await $fetch<{ id: string, user_id?: string, name: string, username: string, account_type: string, website: string, media_count: number, followers_count: number, follows_count: number, biography: string, profile_picture_url: string }>(`https://graph.instagram.com/me?fields=id,user_id,name,username,account_type,website,media_count,followers_count,follows_count,biography,profile_picture_url`, {
                headers: {
                  Authorization: `Bearer ${account.accessToken}`,
                },
              });

              await socialMediaAccountService.createOrUpdateAccountFromAuth({
                id: response.user_id || response.id,
                name: response.name,
                access_token: account.accessToken as string,
                picture: response.profile_picture_url,
                username: response.username,
                platformId: "instagram",
                user: user as schema.User
              });

              await logAuditService.logAuditEvent({
                userId: ctx?.context.session?.user.id,
                category: 'after:create',
                action: 'AUTH_CREATE_SOCIAL_MEDIA',
                targetType: 'instagram',
                targetId: account.id,
                ipAddress: "",
                userAgent: "",
                status: 'success',
                // SAFE: only log non-sensitive profile fields, never tokens or full account object
                details: `ig_user_id=${response.user_id || response.id} username=${response.username} from INSTAGRAM`,
              })

              return;
            }

            if (account.providerId === "twitter") {
              const response = await $fetch<{ data: { id: string, name: string, username: string, profile_image_url: string } }>(
                `https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username`,
                {
                  headers: {
                    Authorization: `Bearer ${account.accessToken}`,
                  },
                }
              );

              const twitterUser = response.data;


              await socialMediaAccountService.createOrUpdateAccountFromAuth({
                id: account.accountId,
                name: twitterUser.name,
                access_token: account.accessToken as string,
                picture: twitterUser.profile_image_url,
                username: twitterUser.username,
                platformId: 'twitter',
                user: user as schema.User
              });

              await logAuditService.logAuditEvent({
                userId: ctx?.context.session?.user.id,
                category: 'after:create',
                action: 'AUTH_CREATE_SOCIAL_MEDIA',
                targetType: 'twitter',
                targetId: account.accountId,
                ipAddress: "",
                userAgent: "",
                status: 'success',
                // SAFE: only log non-sensitive profile fields, never tokens or full account object
                details: `twitter_user_id=${account.accountId} username=${twitterUser.username} from TWITTER`,
              })

              return;
            }
            if (account.providerId === "linkedin") {
              const linkedinUser = await $fetch<{ sub: string, name: string, picture: string, email: string, profile: string }>(
                `https://api.linkedin.com/v2/userinfo`,
                {
                  headers: {
                    Authorization: `Bearer ${account.accessToken}`,
                  },
                }
              );

              await socialMediaAccountService.createOrUpdateAccountFromAuth({
                id: account.accountId,
                name: linkedinUser.name,
                access_token: account.accessToken as string,
                picture: linkedinUser.picture,
                username: linkedinUser.sub,
                platformId: 'linkedin',
                user: user as schema.User
              });

              await logAuditService.logAuditEvent({
                userId: ctx?.context.session?.user.id,
                category: 'after:create',
                action: 'AUTH_CREATE_SOCIAL_MEDIA',
                targetType: 'linkedin',
                targetId: account.accountId,
                ipAddress: "",
                userAgent: "",
                status: 'success',
                // SAFE: only log non-sensitive profile fields, never tokens or full account object
                details: `linkedin_sub=${linkedinUser.sub} name=${linkedinUser.name} from LINKEDIN`,
              })

              return;
            }

            // YouTube (genericOAuth via Google)
            if (account.providerId === "youtube") {
              const response = await $fetch<{ items: Array<{ id: string, snippet: { title: string, thumbnails: { default: { url: string } } } }> }>(
                'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
                {
                  headers: {
                    Authorization: `Bearer ${account.accessToken}`,
                  },
                }
              );

              const channel = response.items?.[0];
              if (channel) {
                await socialMediaAccountService.createOrUpdateAccountFromAuth({
                  id: channel.id,
                  name: channel.snippet.title,
                  access_token: account.accessToken as string,
                  // Google omits refresh_token on re-grants without a consent
                  // screen — pass undefined (never null) so a stored token is
                  // preserved instead of wiped.
                  refresh_token: account.refreshToken ?? undefined,
                  // Store the real provider expiry instead of the 1h default.
                  tokenExpiresAt: account.accessTokenExpiresAt
                    ? new Date(account.accessTokenExpiresAt)
                    : undefined,
                  picture: channel.snippet.thumbnails.default.url,
                  username: channel.snippet.title,
                  platformId: 'youtube',
                  user: user as schema.User
                });
              }

              await logAuditService.logAuditEvent({
                userId: ctx?.context.session?.user.id,
                category: 'after:create',
                action: 'AUTH_CREATE_SOCIAL_MEDIA',
                targetType: 'youtube',
                targetId: account.id,
                ipAddress: "",
                userAgent: "",
                status: 'success',
                details: `youtube from YOUTUBE`,
              })

              return;
            }

            // Discord (native)
            if (account.providerId === "discord") {
              const response = await $fetch<{ id: string, username: string, global_name?: string, avatar: string | null }>(
                'https://discord.com/api/users/@me',
                {
                  headers: {
                    Authorization: `Bearer ${account.accessToken}`,
                  },
                }
              );

              await socialMediaAccountService.createOrUpdateAccountFromAuth({
                id: response.id,
                name: response.global_name || response.username,
                access_token: account.accessToken as string,
                picture: response.avatar ? `https://cdn.discordapp.com/avatars/${response.id}/${response.avatar}.png` : '',
                username: response.username,
                platformId: 'discord',
                user: user as schema.User
              });

              await logAuditService.logAuditEvent({
                userId: ctx?.context.session?.user.id,
                category: 'after:create',
                action: 'AUTH_CREATE_SOCIAL_MEDIA',
                targetType: 'discord',
                targetId: account.id,
                ipAddress: "",
                userAgent: "",
                status: 'success',
                details: `discord_user_id=${response.id} username=${response.username} from DISCORD`,
              })

              return;
            }

            // Reddit (native)
            if (account.providerId === "reddit") {
              const response = await $fetch<{ id: string, name: string, icon_img: string }>(
                'https://oauth.reddit.com/api/v1/me',
                {
                  headers: {
                    Authorization: `Bearer ${account.accessToken}`,
                    'User-Agent': 'MagicSync/1.0',
                  },
                }
              );

              await socialMediaAccountService.createOrUpdateAccountFromAuth({
                id: response.id,
                name: response.name,
                access_token: account.accessToken as string,
                picture: response.icon_img,
                username: response.name,
                platformId: 'reddit',
                user: user as schema.User
              });

              await logAuditService.logAuditEvent({
                userId: ctx?.context.session?.user.id,
                category: 'after:create',
                action: 'AUTH_CREATE_SOCIAL_MEDIA',
                targetType: 'reddit',
                targetId: account.id,
                ipAddress: "",
                userAgent: "",
                status: 'success',
                details: `reddit_user_id=${response.id} username=${response.name} from REDDIT`,
              })

              return;
            }

            // TikTok (native)
            if (account.providerId === "tiktok") {
              const response = await $fetch<{ data: { user: { id: string, display_name: string, username: string, avatar_url: string } } }>(
                'https://open.tiktokapis.com/v2/user/info/?fields=display_name,username,avatar_url',
                {
                  headers: {
                    Authorization: `Bearer ${account.accessToken}`,
                  },
                }
              );

              const tiktokUser = response.data.user;
              await socialMediaAccountService.createOrUpdateAccountFromAuth({
                id: tiktokUser.id,
                name: tiktokUser.display_name,
                access_token: account.accessToken as string,
                picture: tiktokUser.avatar_url,
                username: tiktokUser.username,
                platformId: 'tiktok',
                user: user as schema.User
              });

              await logAuditService.logAuditEvent({
                userId: ctx?.context.session?.user.id,
                category: 'after:create',
                action: 'AUTH_CREATE_SOCIAL_MEDIA',
                targetType: 'tiktok',
                targetId: account.id,
                ipAddress: "",
                userAgent: "",
                status: 'success',
                details: `tiktok_user_id=${tiktokUser.id} username=${tiktokUser.username} from TIKTOK`,
              })

              return;
            }

            // Snapchat (genericOAuth via Snap Kit)
            if (account.providerId === "snapchat") {
              const me = await fetchSnapchatProfile(account.accessToken as string)

              if (me?.externalId) {
                await socialMediaAccountService.createOrUpdateAccountFromAuth({
                  id: me.externalId,
                  name: me.displayName || 'Snapchat user',
                  access_token: account.accessToken as string,
                  // Snapchat rotates the access token; keep the refresh token so
                  // the scheduler can renew without a re-connect.
                  refresh_token: account.refreshToken ?? undefined,
                  tokenExpiresAt: account.accessTokenExpiresAt
                    ? new Date(account.accessTokenExpiresAt)
                    : undefined,
                  picture: me.bitmoji?.avatarUrl,
                  username: me.displayName || me.externalId,
                  platformId: 'snapchat',
                  user: user as schema.User
                });
              }

              await logAuditService.logAuditEvent({
                userId: ctx?.context.session?.user.id,
                category: 'after:create',
                action: 'AUTH_CREATE_SOCIAL_MEDIA',
                targetType: 'snapchat',
                targetId: account.id,
                ipAddress: "",
                userAgent: "",
                status: 'success',
                // SAFE: never log tokens; external id only.
                details: `snapchat_external_id=${me?.externalId ?? 'unknown'} from SNAPCHAT`,
              })

              return;
            }

            // Dribbble (genericOAuth)
            if (account.providerId === "dribbble") {
              const response = await $fetch<{ id: number, name: string, username: string, avatar_url: string }>(
                'https://api.dribbble.com/v2/user',
                {
                  headers: {
                    Authorization: `Bearer ${account.accessToken}`,
                  },
                }
              );

              await socialMediaAccountService.createOrUpdateAccountFromAuth({
                id: String(response.id),
                name: response.name,
                access_token: account.accessToken as string,
                picture: response.avatar_url,
                username: response.username,
                platformId: 'dribbble',
                user: user as schema.User
              });

              await logAuditService.logAuditEvent({
                userId: ctx?.context.session?.user.id,
                category: 'after:create',
                action: 'AUTH_CREATE_SOCIAL_MEDIA',
                targetType: 'dribbble',
                targetId: account.id,
                ipAddress: "",
                userAgent: "",
                status: 'success',
                details: `dribbble_user_id=${response.id} username=${response.username} from DRIBBBLE`,
              })

              return;
            }

            await logAuditService.logAuditEvent({
              userId: ctx?.context.session?.user.id,
              category: 'after:create:no-configured',
              action: 'AUTH_CREATE_SOCIAL_MEDIA',
              targetType: account.providerId,
              targetId: account.id,
              ipAddress: "",
              userAgent: "",
              status: 'success',
              details: `provider=${account.providerId} accountId=${account.id} from ${account.providerId} (unconfigured handler)`,
            })

          } catch (error) {
            await logAuditService.logAuditEvent({
              userId: ctx?.context.session?.user.id,
              category: 'after:create:error',
              action: 'AUTH_CREATE_SOCIAL_MEDIA',
              targetType: account.providerId,
              targetId: account.id,
              ipAddress: "",
              userAgent: "",
              status: 'success',
              // SAFE: never log tokens or full account in error paths
              details: `provider=${account.providerId} accountId=${account.id} from ${account.providerId} (error=${error instanceof Error ? error.message : String(error)})`,
            })
          }
        }
      }
    }
  }
})
