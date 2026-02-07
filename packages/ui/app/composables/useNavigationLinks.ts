import type { NavigationMenuItem } from '@nuxt/ui'

export const useNavigationLinks = () => {
  const { t } = useI18n()
  const route = useRoute()

  const links = computed<NavigationMenuItem[]>(() => [
    {
      label: t('navigation.devDocs'),
      icon: 'i-heroicons-document-text',
      to: `/ui-preview`,
      active: route.path.startsWith(`/ui-preview`),
    },
    {
      label: t('navigation.blogs'),
      icon: 'i-heroicons-newspaper',
      to: `/blog`,
      active: route.path.startsWith(`/blog`)
    },
    {
      label: t('navigation.platform'),
      icon: 'i-heroicons-squares-2x2',
      to: `/platform`,
      active: route.path.startsWith(`/platform`),
      class: "px-10",
      children: [
        {
          label: t('navigation.googleMyBusiness'),
          description: t('navigation.googleMyBusinessDesc'),
          to: `/platform/google-my-business`,
          icon: 'i-lucide-house',

        },
        {
          label: t('navigation.facebook'),
          description: t('navigation.facebookDesc'),
          to: `/platform/facebook`,
          icon: 'i-lucide-facebook'
        },
        {
          label: t('navigation.twitter'),
          description: t('navigation.twitterDesc'),
          to: `/platform/twitter`,
          icon: 'i-lucide-twitter'
        },
        {
          label: t('navigation.instagram'),
          description: t('navigation.instagramDesc'),
          to: `/platform/instagram`,
          icon: 'i-lucide-instagram'
        },
        {
          label: t('navigation.linkedin'),
          description: t('navigation.linkedinDesc'),
          to: `/platform/linkedin`,
          icon: 'i-lucide-linkedin'
        },
        {
          label: t('navigation.pinterest'),
          description: t('navigation.pinterestDesc'),
          to: `/platform/pinterest`,
          icon: 'i-lucide-pinterest'
        }
      ]
    },
    {
      label: t('navigation.tools'),
      icon: 'i-heroicons-wrench',
      to: `/tools`,
      active: route.path.startsWith(`/tools`),
      children: [
        {
          label: 'Image Editor',
          to: `/tools/image-editor`,
          icon: 'i-heroicons-photo'
        },
        {
          label: 'Flutter Clipper',
          to: `/tools/flutter-clipper`,
          icon: 'i-heroicons-scissors'
        },
        {
          label: 'Video Silence Remover',
          to: `/tools/video-silence-remover`,
          icon: 'i-heroicons-video-camera'
        },
        {
          label: 'Text Behind Image',
          to: `/tools/text-behind-image-free`,
          icon: 'i-heroicons-document-text'
        }
      ]
    },
    {
      label: t('navigation.playground'),
      icon: 'i-heroicons-play',
      to: `/playground`,
      active: route.path.startsWith(`/playground`)
    }
  ])

  const footerLinks = computed(() => ({
    platform: {
      title: t('footer.platform'),
      items: [
        { label: t('footer.overview'), to: '/overview' },
        { label: t('footer.features'), to: '/features' },
        { label: t('footer.integrations'), to: '/integrations' },
        { label: t('footer.pricing'), to: '/pricing' },
        { label: t('footer.changelog'), to: '/changelog' },
        { label: t('footer.status'), to: '/status' },
      ]
    },
    resources: {
      title: t('footer.resources'),
      items: [
        { label: t('footer.documentation'), to: '/documentation' },
        { label: t('footer.apiReference'), to: '/api-reference' },
        { label: t('footer.guides'), to: '/guides' },
        { label: t('footer.blog'), to: '/blog' },
        { label: t('footer.community'), to: '/community' },
        { label: t('footer.support'), to: '/support' },
      ]
    },
    company: {
      title: t('footer.company'),
      items: [
        { label: t('footer.aboutUs'), to: '/about-us' },
        { label: t('footer.careers'), to: '/release-notes' },
        { label: t('footer.pressKit'), to: '/privacy-policy' },
        { label: t('footer.partners'), to: '/partners' },
        { label: t('footer.contact'), to: '/contact' },
        { label: t('footer.legal'), to: '/terms-of-use' },
      ]
    },
    legal: [
      { label: t('footer.privacyPolicy'), to: '/privacy-policy' },
      { label: t('footer.termsOfService'), to: '/terms-of-use' },
      { label: t('footer.cookiePolicy'), to: '/privacy-policy' },
    ]
  }))

  const features = computed(() => [
    {
      title: t('features.multiPlatform.title'),
      subtitle: t('features.multiPlatform.subtitle'),
      stats: t('features.multiPlatform.stats')
    },
    {
      title: t('features.businessIsolation.title'),
      subtitle: t('features.businessIsolation.subtitle'),
      stats: t('features.businessIsolation.stats')
    },
    {
      title: t('features.mediaLibrary.title'),
      subtitle: t('features.mediaLibrary.subtitle'),
      stats: t('features.mediaLibrary.stats')
    },
    {
      title: t('features.visualCalendar.title'),
      subtitle: t('features.visualCalendar.subtitle'),
      stats: t('features.visualCalendar.stats')
    },
    {
      title: t('features.aiRepurposing.title'),
      subtitle: t('features.aiRepurposing.subtitle'),
      stats: t('features.aiRepurposing.stats')
    },
    {
      title: t('features.bulkCsvImport.title'),
      subtitle: t('features.bulkCsvImport.subtitle'),
      stats: t('features.bulkCsvImport.stats')
    },
    {
      title: t('features.systemVariables.title'),
      subtitle: t('features.systemVariables.subtitle'),
      stats: t('features.systemVariables.stats')
    },
    {
      title: t('features.aiPostAssistant.title'),
      subtitle: t('features.aiPostAssistant.subtitle'),
      stats: t('features.aiPostAssistant.stats')
    },
    {
      title: t('features.masterPostEditor.title'),
      subtitle: t('features.masterPostEditor.subtitle'),
      stats: t('features.masterPostEditor.stats')
    }
  ])

  return {
    links,
    footerLinks,
    features
  }
}
