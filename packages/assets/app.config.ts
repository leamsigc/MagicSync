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
    PEXELS_API_KEY: string
    FILE_STORAGE_MOUNT: string
  }
}
