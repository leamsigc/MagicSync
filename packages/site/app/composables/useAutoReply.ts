export interface AutoReplyLink {
  id: string
  label: string
  target: string
  clicks: number
}

export interface AutoReplyCampaign {
  id: string
  userId: string
  businessId?: string
  name: string
  platform: 'instagram'
  socialAccountId: string
  externalPostIds: string[]
  matchAllPosts?: boolean
  keywords: string[]
  matchMode: 'whole' | 'partial'
  dmTemplate: string
  linkIds: string[]
  links?: AutoReplyLink[]
  publicReplyTemplate?: string
  storyDmEnabled?: boolean
  followGate: boolean
  followPromptTemplate?: string
  enabled: boolean
  mode?: 'template' | 'ai'
  createdAt: string
  updatedAt: string
}

export interface AutoReplyLog {
  commentId: string
  authorId: string
  authorName: string
  matchedKeyword?: string
  action: 'sent' | 'skipped' | 'failed'
  reason: string
  at: string
}

export interface AutoReplyStats {
  sent: number
  skipped: number
  failed: number
  clicksPerLink: Array<{ linkId: string; label: string; target: string; clicks: number }>
}

export function useAutoReply() {
  const campaigns = useState<AutoReplyCampaign[]>('auto-reply-campaigns', () => [])
  const loading = useState<boolean>('auto-reply-loading', () => false)
  const error = useState<string | null>('auto-reply-error', () => null)

  function toMessage(err: unknown, fallback: string): string {
    const e = err as { data?: { statusMessage?: string; message?: string }; message?: string }
    // Prefer `message` (carries the detailed reason, e.g. Meta's text);
    // `statusMessage` is intentionally generic single-line (multi-line values
    // abort the Node response and surface as a proxy HTML error page).
    // Also detect proxy HTML bodies (Cloudflare 502/524 pages) and say so.
    if (typeof e.data === 'string' && /<!DOCTYPE html|<html/i.test(e.data)) {
      return 'Server returned an HTML error page instead of JSON (proxy/gateway failure) — check server logs'
    }
    return e.data?.message || e.data?.statusMessage || e.message || fallback
  }

  async function fetchCampaigns() {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<{ success: boolean; data: AutoReplyCampaign[] }>('/api/v1/auto-reply/campaigns')
      campaigns.value = res.data || []
    } catch (err) {
      error.value = toMessage(err, 'Failed to load campaigns')
    } finally {
      loading.value = false
    }
  }

  async function createCampaign(input: Record<string, unknown>) {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<{ success: boolean; data: AutoReplyCampaign }>('/api/v1/auto-reply/campaigns', {
        method: 'POST',
        body: input,
      })
      campaigns.value = [res.data, ...campaigns.value]
      return res.data
    } catch (err) {
      error.value = toMessage(err, 'Failed to create campaign')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateCampaign(id: string, patch: Record<string, unknown>) {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<{ success: boolean; data: AutoReplyCampaign }>(`/api/v1/auto-reply/campaigns/${id}`, {
        method: 'PUT',
        body: patch,
      })
      campaigns.value = campaigns.value.map((c) => (c.id === id ? res.data : c))
      return res.data
    } catch (err) {
      error.value = toMessage(err, 'Failed to update campaign')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteCampaign(id: string) {
    loading.value = true
    error.value = null
    try {
      await $fetch(`/api/v1/auto-reply/campaigns/${id}`, { method: 'DELETE' })
      campaigns.value = campaigns.value.filter((c) => c.id !== id)
    } catch (err) {
      error.value = toMessage(err, 'Failed to delete campaign')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function toggleCampaign(id: string, enabled: boolean) {
    return updateCampaign(id, { enabled })
  }

  async function fetchLogs(id: string, limit = 25): Promise<AutoReplyLog[]> {
    try {
      const res = await $fetch<{ success: boolean; data: AutoReplyLog[] }>(`/api/v1/auto-reply/campaigns/${id}/logs`, {
        query: { limit },
      })
      return res.data || []
    } catch (err) {
      error.value = toMessage(err, 'Failed to load logs')
      return []
    }
  }

  async function fetchStats(id: string): Promise<AutoReplyStats | null> {
    try {
      const res = await $fetch<{ success: boolean; data: AutoReplyStats }>(`/api/v1/auto-reply/campaigns/${id}/stats`)
      return res.data
    } catch (err) {
      error.value = toMessage(err, 'Failed to load stats')
      return null
    }
  }

  async function fetchWebhookStatus(): Promise<{ verifyTokenConfigured: boolean; callbackUrl: string; appIdConfigured: boolean } | null> {
    try {
      const res = await $fetch<{ success: boolean; data: { verifyTokenConfigured: boolean; callbackUrl: string; appIdConfigured: boolean } }>('/api/v1/auto-reply/webhooks/status')
      return res.data
    } catch (err) {
      error.value = toMessage(err, 'Failed to load webhook status')
      return null
    }
  }

  async function subscribeWebhooks(socialAccountId: string): Promise<string[] | null> {
    try {
      const res = await $fetch<{ success: boolean; data: { subscribed_fields: string[] } }>('/api/v1/auto-reply/webhooks/subscribe', {
        method: 'POST',
        body: { socialAccountId },
      })
      return res.data?.subscribed_fields ?? null
    } catch (err) {
      error.value = toMessage(err, 'Failed to subscribe webhooks')
      return null
    }
  }

  async function testMatch(id: string | null, text: string, keywords: string[], matchMode: 'whole' | 'partial'): Promise<string | null> {
    try {
      if (!id) {
        const hay = (text || '').toLowerCase()
        for (const kw of keywords) {
          const k = (kw || '').trim().toLowerCase()
          if (!k) continue
          if (matchMode === 'partial' ? hay.includes(k) : new RegExp(`(^|[^\\p{L}\\p{N}_])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}_]|$)`, 'iu').test(text || '')) {
            return kw.trim()
          }
        }
        return null
      }
      const res = await $fetch<{ success: boolean; data: { matched: string | null } }>(`/api/v1/auto-reply/campaigns/${id}/test`, {
        method: 'POST',
        body: { text, keywords, matchMode },
      })
      return res.data?.matched ?? null
    } catch (err) {
      error.value = toMessage(err, 'Match test failed')
      return null
    }
  }

  return {
    campaigns,
    loading,
    error,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    toggleCampaign,
    fetchLogs,
    fetchStats,
    fetchWebhookStatus,
    subscribeWebhooks,
    testMatch,
  }
}
