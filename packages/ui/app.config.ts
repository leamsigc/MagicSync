export default defineAppConfig({
  BaseUiLayer: {
    name: 'Hello from Nuxt layer',
    footer: {
      main: {
        company: "MagicSync",
        logo: '/img/logo.png'
      },
      companyName: 'Default Company',
      socialLinks: [
        {
          name: 'Twitter',
          icon: 'lucide:twitter',
          url: '#',
        },
        {
          name: 'Facebook',
          icon: 'lucide:facebook',
          url: '#',
        },
        {
          name: 'Instagram',
          icon: 'lucide:instagram',
          url: '#',
        },
        {
          name: 'LinkedIn',
          icon: 'lucide:linkedin',
          url: '#',
        },
        {
          name: 'YouTube',
          icon: 'logos:youtube-icon',
          url: '#',
        }
      ]
    }
  }
})

declare module '@nuxt/schema' {
  interface AppConfigInput {
    BaseUiLayer: {
      name?: string,
      main: {
        company?: string
        logo?: string
      }
      footer: {
        companyName?: string
        socialLinks?: Array<{
          name: string
          icon: string
          url: string
        }>
      }
    }
  }
}
