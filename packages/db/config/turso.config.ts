const isProd = process.env.NODE_ENV === 'production'
const authToken = process.env.NUXT_TURSO_AUTH_TOKEN

export const tursoConfig = {
  isProd,
  url: process.env.NUXT_TURSO_DATABASE_URL as string || 'file:../../local.db',
  ...(authToken && { authToken })
}
