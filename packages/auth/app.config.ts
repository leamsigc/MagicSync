export default defineAppConfig({
  myLayer: {
    name: 'Hello from Nuxt layer'
  }
})

declare module '@nuxt/schema' {
  interface AppConfigInput {
    myLayer?: {
      /** Project name */
      name?: string
    }
  }
  interface RuntimeConfig {
    NUXT_BETTER_AUTH_URL: string
    NUXT_GOOGLE_CLIENT_ID: string
    NUXT_GOOGLE_CLIENT_SECRET: string
    NUXT_FACEBOOK_CLIENT_ID: string
    NUXT_FACEBOOK_CLIENT_SECRET: string
    NUXT_FACEBOOK_CONFIG_ID: string
  }
}
