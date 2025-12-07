import { APIError, betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, createAuthMiddleware, genericOAuth } from 'better-auth/plugins'
import * as schema from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'


export const auth = betterAuth({
  baseURL: process.env.NUXT_BETTER_AUTH_URL || 'http://localhost:3000',
  database: drizzleAdapter(useDrizzle(), {
    provider: 'sqlite',
    schema: {
      ...schema
    }
  }),
  user: {
    additionalFields: {
      firstName: {
        type: 'string',
        fieldName: 'firstName',
        returned: true,
        input: true,
        required: true
      },
      lastName: {
        type: 'string',
        fieldName: 'lastName',
        returned: true,
        input: true,
        required: true
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
      allowDifferentEmails: true,
      updateUserInfoOnLink: true,
      allowUnlinkingAll: false,
      trustedProviders: ['google', 'facebook', 'email-password', 'linkedin', 'twitter', 'tiktok', 'threads', 'youtube', 'reddit', 'discord', 'dribbble'],
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.NUXT_GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.NUXT_GOOGLE_CLIENT_SECRET as string,
      accessType: "offline",
      // prompt: "select_account+consent",
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/business.manage',
        'https://www.googleapis.com/auth/plus.business.manage'
      ]
    },
    facebook: {
      clientId: process.env.NUXT_FACEBOOK_CLIENT_ID as string,
      clientSecret: process.env.NUXT_FACEBOOK_CLIENT_SECRET as string,
      configId: process.env.NUXT_FACEBOOK_CONFIG_ID as string,
      scopes: [
        "email",
        "public_profile",
        'pages_show_list',
        'business_management',
        'read_insights',
        'pages_manage_posts',
        'pages_read_engagement',
        'pages_manage_engagement',
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_insights',
        'instagram_manage_comments',
      ],
    },
    // Native Better Auth social providers
    discord: {
      clientId: process.env.NUXT_DISCORD_CLIENT_ID as string,
      clientSecret: process.env.NUXT_DISCORD_CLIENT_SECRET as string,
      scopes: ['identify', 'guilds', 'guilds.members.read', 'messages.read'],
    },
    reddit: {
      clientId: process.env.NUXT_REDDIT_CLIENT_ID as string,
      clientSecret: process.env.NUXT_REDDIT_CLIENT_SECRET as string,
      scopes: ['identity', 'submit', 'edit', 'read', 'mysubreddits', 'vote', 'history'],
    },
    linkedin: {
      clientId: process.env.NUXT_LINKEDIN_CLIENT_ID as string,
      clientSecret: process.env.NUXT_LINKEDIN_CLIENT_SECRET as string,
      scopes: ['openid', 'profile', 'email', 'w_member_social'],
    },
    tiktok: {
      clientKey: process.env.NUXT_TIKTOK_CLIENT_ID as string,
      clientSecret: process.env.NUXT_TIKTOK_CLIENT_SECRET as string,
    },
    twitter: {
      clientId: process.env.NUXT_TWITTER_CLIENT_ID as string,
      clientSecret: process.env.NUXT_TWITTER_CLIENT_SECRET as string,
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const ipAddress = ctx.getHeader('x-forwarded-for')
        || ctx.getHeader('remoteAddress') || undefined
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
          const provider = ctx.params.id
          await await logAuditService.logAuditEvent({
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
            details: returned.body?.message
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
          await await logAuditService.logAuditEvent({
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
          providerId: 'linkedin-page',
          clientId: process.env.NUXT_LINKEDIN_CLIENT_ID as string,
          clientSecret: process.env.NUXT_LINKEDIN_CLIENT_SECRET as string,
          authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
          tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
          userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
          scopes: ['openid', 'profile', 'email', 'r_organization_social', 'w_organization_social', 'rw_organization_admin'],
          pkce: false,
        },

        // YouTube (uses Google OAuth with YouTube scopes) - not natively supported
        {
          providerId: 'youtube',
          clientId: process.env.NUXT_GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.NUXT_GOOGLE_CLIENT_SECRET as string,
          discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
          scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube'],
          pkce: false,
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
          pkce: false,
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
          pkce: false,
        },
      ]
    })
  ]
})
