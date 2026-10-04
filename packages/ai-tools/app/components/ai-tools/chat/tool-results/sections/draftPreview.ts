export interface SocialAccount {
  id: string
  platform?: string
  accountName?: string
}

export interface PostTab {
  id: string
  label: string
  platform: string
  account?: string
  accountId?: string
  caption: string
  claims: string[]
}

export type PostStatus = 'scheduled' | 'published'

export interface PostPayload {
  businessId: string
  content: string
  targetPlatforms: string[]
  scheduledAt: string
  status: PostStatus
}

export type PreviewVariant = 'feed' | 'vertical' | 'channel'

export interface PlatformChrome {
  variant: PreviewVariant
  actions: string[]
  upvote: boolean
}

export function normalizePlatform(platform: string): string {
  const key = platform.toLowerCase()
  if (key === 'twitter') return 'x'
  return key
}

export function platformLabel(platform: string): string {
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

export const platformChrome: Record<string, PlatformChrome> = {
  facebook: {
    variant: 'feed',
    actions: ['i-heroicons-hand-thumb-up', 'i-heroicons-chat-bubble-left', 'i-heroicons-share'],
    upvote: false,
  },
  x: {
    variant: 'feed',
    actions: ['i-heroicons-chat-bubble-oval-left-ellipsis', 'i-heroicons-arrow-path', 'i-heroicons-heart', 'i-heroicons-chart-bar'],
    upvote: false,
  },
  instagram: {
    variant: 'feed',
    actions: ['i-heroicons-heart', 'i-heroicons-chat-bubble-oval-left', 'i-heroicons-paper-airplane', 'i-heroicons-bookmark'],
    upvote: false,
  },
  linkedin: {
    variant: 'feed',
    actions: ['i-heroicons-hand-thumb-up', 'i-heroicons-chat-bubble-left', 'i-heroicons-arrow-path', 'i-heroicons-paper-airplane'],
    upvote: false,
  },
  tiktok: {
    variant: 'vertical',
    actions: ['i-heroicons-heart', 'i-heroicons-chat-bubble-oval-left', 'i-heroicons-share'],
    upvote: false,
  },
  reddit: {
    variant: 'feed',
    actions: ['i-heroicons-chat-bubble-left', 'i-heroicons-share', 'i-heroicons-bookmark'],
    upvote: true,
  },
  discord: {
    variant: 'channel',
    actions: ['i-heroicons-face-smile', 'i-heroicons-gif', 'i-heroicons-plus-circle'],
    upvote: false,
  },
  default: {
    variant: 'feed',
    actions: ['i-heroicons-heart', 'i-heroicons-chat-bubble-left', 'i-heroicons-share'],
    upvote: false,
  },
}

export function chromeFor(platform: string): PlatformChrome {
  return platformChrome[normalizePlatform(platform)] ?? platformChrome.default
}

function matchesPlatform(accountPlatform: string | undefined, platform: string): boolean {
  if (!accountPlatform) return false
  return normalizePlatform(accountPlatform) === normalizePlatform(platform)
}

export function accountForTab(accounts: SocialAccount[], tab: PostTab): SocialAccount | null {
  if (tab.accountId) return accounts.find(account => account.id === tab.accountId) ?? null
  if (tab.platform === 'social') return accounts[0] ?? null
  return accounts.find(account => matchesPlatform(account.platform, tab.platform)) ?? null
}

export function buildPostPayload(input: {
  businessId: string
  caption: string
  accountId: string
  scheduledAt: string
  status: PostStatus
}): PostPayload {
  return {
    businessId: input.businessId,
    content: input.caption,
    targetPlatforms: [input.accountId],
    scheduledAt: input.scheduledAt,
    status: input.status,
  }
}
