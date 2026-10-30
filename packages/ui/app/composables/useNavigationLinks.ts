import type { NavigationMenuItem } from '@nuxt/ui'

export const useNavigationLinks = () => {
  const { t } = useI18n()
  const route = useRoute()

  const agents = computed<NavigationMenuItem[]>(() => [
    { label: 'ChatGPT', to: '/for/chatgpt', icon: 'i-simple-icons:openai', description: t('navigation.agentDesc.chatgpt') },
    { label: 'Claude', to: '/for/claude', icon: 'i-simple-icons:anthropic', description: t('navigation.agentDesc.claude') },
    { label: 'Claude Code', to: '/for/claude-code', icon: 'i-simple-icons:anthropic', description: t('navigation.agentDesc.claudeCode') },
    { label: 'Codex', to: '/for/codex', icon: 'i-simple-icons:openai', description: t('navigation.agentDesc.codex') },
    { label: 'Cursor', to: '/for/cursor', icon: 'i-simple-icons:cursor', description: t('navigation.agentDesc.cursor') },
    { label: 'OpenClaw', to: '/for/openclaw', icon: 'i-lucide:bot', description: t('navigation.agentDesc.openclaw') },
    { label: 'Hermes Agent', to: '/for/hermes-agent', icon: 'i-lucide:send', description: t('navigation.agentDesc.hermes') },
    { label: 'Grok Bot', to: '/for/grok-bot', icon: 'i-simple-icons:x', description: t('navigation.agentDesc.grokBot') },
    { label: 'Grok Build', to: '/for/grok-build', icon: 'i-simple-icons:x', description: t('navigation.agentDesc.grokBuild') },
    { label: 'Muse', to: '/for/muse', icon: 'i-lucide:sparkles', description: t('navigation.agentDesc.muse') },
    { label: 'Perplexity Computer', to: '/for/perplexity-computer', icon: 'i-simple-icons:perplexity', description: t('navigation.agentDesc.perplexity') },
    { label: 'nanoclaw', to: '/for/nanoclaw', icon: 'i-lucide:message-circle', description: t('navigation.agentDesc.nanoclaw') },
    { label: 'Paperclip', to: '/for/paperclip', icon: 'i-lucide:paperclip', description: t('navigation.agentDesc.paperclip') },
    { label: 'MCP Server', to: '/for/mcp', icon: 'i-lucide:server', description: t('navigation.agentDesc.mcp') },
    { label: 'AI Agents CLI', to: '/for/agent', icon: 'i-lucide:terminal', description: t('navigation.agentDesc.cli') },
  ])

  const platforms = computed<NavigationMenuItem[]>(() => [
    { label: 'Facebook', to: '/platform/facebook', icon: 'i-simple-icons:facebook', description: t('navigation.platformDesc.facebook') },
    { label: 'Instagram', to: '/platform/instagram', icon: 'i-simple-icons:instagram', description: t('navigation.platformDesc.instagram') },
    { label: 'X (Twitter)', to: '/platform/twitter', icon: 'i-simple-icons:x', description: t('navigation.platformDesc.twitter') },
    { label: 'LinkedIn', to: '/platform/linkedin', icon: 'i-simple-icons:linkedin', description: t('navigation.platformDesc.linkedin') },
    { label: 'TikTok', to: '/platform/tiktok', icon: 'i-simple-icons:tiktok', description: t('navigation.platformDesc.tiktok') },
    { label: 'YouTube', to: '/platform/youtube', icon: 'i-simple-icons:youtube', description: t('navigation.platformDesc.youtube') },
    { label: 'Threads', to: '/platform/threads', icon: 'i-simple-icons:threads', description: t('navigation.platformDesc.threads') },
    { label: 'Bluesky', to: '/platform/bluesky', icon: 'i-simple-icons:bluesky', description: t('navigation.platformDesc.bluesky') },
    { label: 'Pinterest', to: '/platform/pinterest', icon: 'i-simple-icons:pinterest', description: t('navigation.platformDesc.pinterest') },
    { label: 'Reddit', to: '/platform/reddit', icon: 'i-simple-icons:reddit', description: t('navigation.platformDesc.reddit') },
    { label: 'Discord', to: '/platform/discord', icon: 'i-simple-icons:discord', description: t('navigation.platformDesc.discord') },
    { label: 'Dribbble', to: '/platform/dribbble', icon: 'i-simple-icons:dribbble', description: t('navigation.platformDesc.dribbble') },
    { label: 'DEV Community', to: '/platform/devto', icon: 'i-simple-icons:devdotto', description: t('navigation.platformDesc.devto') },
    { label: 'WordPress', to: '/platform/wordpress', icon: 'i-simple-icons:wordpress', description: t('navigation.platformDesc.wordpress') },
    { label: 'Mastodon', to: '/platform/mastodon', icon: 'i-simple-icons:mastodon', description: t('navigation.platformDesc.mastodon') },
    { label: 'Snapchat', to: '/platform/snapchat', icon: 'i-simple-icons:snapchat', description: t('navigation.platformDesc.snapchat') },
    { label: 'Google Business', to: '/platform/google-my-business', icon: 'i-simple-icons:google', description: t('navigation.platformDesc.google') },
  ])

  const tools = computed<NavigationMenuItem[]>(() => [
    { label: 'Chat', to: '/app/chat', icon: 'i-lucide:message-square', description: t('navigation.toolDesc.chat') },
    { label: 'Knowledge', to: '/app/ai-tools/knowledge', icon: 'i-lucide:book-open', description: t('navigation.toolDesc.knowledge') },
    { label: 'Skills', to: '/app/ai-tools/skills', icon: 'i-lucide:wrench', description: t('navigation.toolDesc.skills') },
    { label: 'Agents', to: '/app/ai-tools/agents', icon: 'i-lucide:bot', description: t('navigation.toolDesc.agents') },
    { label: 'AI Tools', to: '/app/ai-tools/tools', icon: 'i-lucide:hammer', description: t('navigation.toolDesc.aiTools') },
    { label: 'Growth Strategy', to: '/app/tools/growth-stratergy', icon: 'i-lucide:rocket', description: t('navigation.toolDesc.growth') },
    { label: 'Image Editor', to: '/tools/image-editor', icon: 'i-heroicons:photo', description: t('navigation.toolDesc.imageEditor') },
    { label: 'Flutter Clipper', to: '/tools/flutter-clipper', icon: 'i-heroicons:scissors', description: t('navigation.toolDesc.flutterClipper') },
    { label: 'Video Silence Remover', to: '/tools/video-silence-remover', icon: 'i-heroicons:video-camera', description: t('navigation.toolDesc.videoSilence') },
    { label: 'Text Behind Image', to: '/tools/text-behind-image-free', icon: 'i-heroicons:document-text', description: t('navigation.toolDesc.textBehindImage') },
    { label: 'Playground', to: '/playground', icon: 'i-heroicons:play', description: t('navigation.toolDesc.playground') },
  ])

  const links = computed<NavigationMenuItem[]>(() => [
    {
      label: t('navigation.blogs'),
      icon: 'i-heroicons-newspaper',
      to: `/blog`,
      active: route.path.startsWith(`/blog`)
    },
    {
      label: t('navigation.useAi'),
      icon: 'i-lucide-bot',
      to: '/for',
      active: route.path.startsWith('/for'),
      children: agents.value,
    },
    {
      label: t('navigation.platform'),
      icon: 'i-heroicons-squares-2x2',
      to: `/platform`,
      active: route.path.startsWith(`/platform`),
      children: platforms.value,
    },
    {
      label: t('navigation.tools'),
      icon: 'i-heroicons-wrench',
      to: `/tools`,
      active: route.path.startsWith(`/tools`) || route.path.startsWith('/app/ai-tools') || route.path.startsWith('/app/chat') || route.path.startsWith('/playground'),
      children: tools.value,
    },
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
    socialPlatforms: {
      title: t('footer.socialPlatformsTitle'),
      items: [
        {
          label: t('footer.platformItems.facebook.label'),
          description: t('footer.platformItems.facebook.description'),
          icon: 'i-simple-icons-facebook',
          to: '/platform/facebook'
        },
        {
          label: t('footer.platformItems.instagram.label'),
          description: t('footer.platformItems.instagram.description'),
          icon: 'i-simple-icons-instagram',
          to: '/platform/instagram'
        },
        {
          label: t('footer.platformItems.twitter.label'),
          description: t('footer.platformItems.twitter.description'),
          icon: 'i-simple-icons-x',
          to: '/platform/twitter'
        },
        {
          label: t('footer.platformItems.linkedin.label'),
          description: t('footer.platformItems.linkedin.description'),
          icon: 'i-simple-icons-linkedin',
          to: '/platform/linkedin'
        },
        {
          label: t('footer.platformItems.pinterest.label'),
          description: t('footer.platformItems.pinterest.description'),
          icon: 'i-simple-icons-pinterest',
          to: '/platform/pinterest'
        },
        {
          label: t('footer.platformItems.googleBusiness.label'),
          description: t('footer.platformItems.googleBusiness.description'),
          icon: 'i-simple-icons-google',
          to: '/platform/google-my-business'
        },
        {
          label: t('footer.platformItems.tiktok.label'),
          description: t('footer.platformItems.tiktok.description'),
          icon: 'i-simple-icons-tiktok',
          to: '/platform/tiktok'
        },
        {
          label: t('footer.platformItems.youtube.label'),
          description: t('footer.platformItems.youtube.description'),
          icon: 'i-simple-icons-youtube',
          to: '/platform/youtube'
        },
        {
          label: t('footer.platformItems.bluesky.label'),
          description: t('footer.platformItems.bluesky.description'),
          icon: 'i-simple-icons-bluesky',
          to: '/platform/bluesky'
        },
        {
          label: t('footer.platformItems.threads.label'),
          description: t('footer.platformItems.threads.description'),
          icon: 'i-simple-icons-threads',
          to: '/platform/threads'
        },
        {
          label: t('footer.platformItems.reddit.label'),
          description: t('footer.platformItems.reddit.description'),
          icon: 'i-simple-icons-reddit',
          to: '/platform/reddit'
        },
        {
          label: t('footer.platformItems.discord.label'),
          description: t('footer.platformItems.discord.description'),
          icon: 'i-simple-icons-discord',
          to: '/platform/discord'
        },
        {
          label: t('footer.platformItems.mastodon.label'),
          description: t('footer.platformItems.mastodon.description'),
          icon: 'i-simple-icons-mastodon',
          to: '/platform/mastodon'
        },
        {
          label: t('footer.platformItems.dribbble.label'),
          description: t('footer.platformItems.dribbble.description'),
          icon: 'i-simple-icons-dribbble',
          to: '/platform/dribbble'
        },
        {
          label: t('footer.platformItems.devto.label'),
          description: t('footer.platformItems.devto.description'),
          icon: 'i-simple-icons-devdotto',
          to: '/integrations'
        },
        {
          label: t('footer.platformItems.wordpress.label'),
          description: t('footer.platformItems.wordpress.description'),
          icon: 'i-simple-icons-wordpress',
          to: '/platform/wordpress'
        },
        {
          label: t('footer.platformItems.snapchat.label'),
          description: t('footer.platformItems.snapchat.description'),
          icon: 'i-simple-icons-snapchat',
          to: '/platform/snapchat'
        },
        {
          label: t('footer.platformItems.devnull.label'),
          description: t('footer.platformItems.devnull.description'),
          icon: 'i-lucide-terminal',
          to: '/integrations'
        }
      ]
    },
    aiAgents: {
      title: t('footer.aiAgentsTitle'),
      items: agents.value.map(agent => ({
        label: agent.label,
        description: agent.description,
        icon: agent.icon,
        to: agent.to,
      }))
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
    t,
    links,
    footerLinks,
    features,
    agents,
    platforms,
    tools
  }
}
