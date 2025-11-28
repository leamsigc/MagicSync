const isProd = process.env.NODE_ENV === 'production'

export const tursoConfig = {
  isProd,
  url: process.env.NUXT_TURSO_DATABASE_URL as string,
  authToken: process.env.NUXT_TURSO_AUTH_TOKEN as string
}
