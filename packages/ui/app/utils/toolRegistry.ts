export type ToolAudience = 'free' | 'app'

export type ToolCategory = 'create' | 'convert' | 'optimize' | 'learn'

export type ToolBadge = 'pro' | 'beta'

export interface ToolDefinition {
  id: string
  name: string
  description: string
  icon: string
  route: string
  audience: ToolAudience
  category: ToolCategory
  badge?: ToolBadge
  image?: string
  date?: string
}

export const TOOL_CATEGORIES: ToolCategory[] = ['create', 'convert', 'optimize', 'learn']

export const toolRegistry: ToolDefinition[] = [
  {
    id: 'image-editor',
    name: 'Image Editor',
    description: 'Edit your images for free and use templates for social media',
    icon: 'i-lucide-image',
    route: '/tools/image-editor',
    audience: 'free',
    category: 'create',
    image: '/img/ImageEditor.png',
    date: '2024-11-25'
  },
  {
    id: 'flutter-clipper',
    name: 'Flutter clipper',
    description: 'Create Custom clippers for your flutter apps',
    icon: 'i-lucide-scissors',
    route: '/tools/flutter-clipper',
    audience: 'free',
    category: 'create',
    image: '/img/flutter-clipper.png',
    date: '2024-11-04'
  },
  {
    id: 'text-behind-image-free',
    name: 'Text Behind Image Free',
    description: 'Create stunning text behind your images for free',
    icon: 'i-lucide-type',
    route: '/tools/text-behind-image-free',
    audience: 'free',
    category: 'create',
    image: '/img/text-behind.png',
    date: '2026-01-01'
  },
  {
    id: 'og-image-generator',
    name: 'OG Image Generator',
    description: 'Generate Open Graph & social images with templates, code or layered design',
    icon: 'i-lucide-image-plus',
    route: '/tools/og-image-generator',
    audience: 'free',
    category: 'create',
    badge: 'beta',
    image: '/img/og_generator.png',
    date: '2026-08-23'
  },
  {
    id: 'menu-board',
    name: 'Dynamic Menu Board',
    description: 'Build rotating digital signage menu boards for TVs, preview fullscreen and share a public link',
    icon: 'i-lucide-monitor-play',
    route: '/tools/menu-board',
    audience: 'free',
    category: 'create',
    badge: 'beta',
    image: '/img/restaurant_menu.png',
    date: '2026-08-23'
  },
  {
    id: 'carousel-creator',
    name: 'Instagram Carousel Creator',
    description: 'Design consistent multi-slide Instagram carousels with templates, presets and one-click export',
    icon: 'i-lucide-gallery-horizontal',
    route: '/tools/carousel-creator',
    audience: 'free',
    category: 'create',
    image: '/img/instagram_carousel.png',
    date: '2026-08-23'
  },
  {
    id: 'video-silence-remover',
    name: 'Video Silence Remover',
    description: 'Remove silent parts from your videos automatically with our free online tool',
    icon: 'i-lucide-volume-x',
    route: '/tools/video-silence-remover',
    audience: 'free',
    category: 'convert',
    image: '/img/video-remover.png',
    date: '2024-12-11'
  },
  {
    id: 'audio-transcription',
    name: 'Audio Transcription',
    description: 'Transcribe audio and video files to text with timestamps using AI',
    icon: 'i-lucide-mic',
    route: '/tools/audio-transcription',
    audience: 'free',
    category: 'convert',
    image: '/img/audio-transcription.png',
    date: '2026-03-09'
  },
  {
    id: 'content-split',
    name: 'Content Repurpose',
    description: 'Split one idea into platform-ready posts for every social channel',
    icon: 'i-lucide-recycle',
    route: '/app/tools/content-split',
    audience: 'app',
    category: 'convert',
    image: '/img/reporpuse_content.png',
    date: '2026-08-23'
  },
  {
    id: 'text-to-speech',
    name: 'Text to Speech',
    description: 'Convert text to natural AI speech — free, private, in-browser with Transformers.js',
    icon: 'i-lucide-volume-2',
    route: '/app/tools/text-to-speech',
    audience: 'app',
    category: 'convert',
    image: '/img/text-to-speech.png',
    date: '2026-07-16'
  },
  {
    id: 'growth-stratergy',
    name: 'Growth Strategies',
    description: 'Plan data-driven growth strategies for every platform',
    icon: 'i-lucide-trending-up',
    route: '/app/tools/growth-stratergy',
    audience: 'app',
    category: 'optimize',
    badge: 'pro',
    image: '/img/content_pipeline.png',
    date: '2026-08-23'
  },
  {
    id: 'video-cropper',
    name: 'Video Cropper',
    description: 'Crop, split-screen, and keyframe your videos with multi-camera motion tracking',
    icon: 'i-lucide-crop',
    route: '/app/tools/video-cropper',
    audience: 'app',
    category: 'optimize',
    image: '/img/video-cropper.png',
    date: '2026-07-15'
  },
  {
    id: 'audio-player',
    name: 'Audio Player',
    description: 'Stream audio from Bunny CDN or play local files with waveform visualization',
    icon: 'i-lucide-audio-lines',
    route: '/tools/audio-player',
    audience: 'free',
    category: 'learn',
    image: '/img/audio-player.png',
    date: '2026-03-19'
  },
  {
    id: 'podcast',
    name: 'Podcast Player',
    description: 'Discover and listen to the best tech podcasts with a global player',
    icon: 'i-lucide-podcast',
    route: '/tools/podcast',
    audience: 'free',
    category: 'learn',
    image: '/img/podcast-player.png',
    date: '2026-03-19'
  }
]

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return toolRegistry.filter(tool => tool.category === category)
}
