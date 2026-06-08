export function useTokenHealthNotification() {
  const toast = useToast()
  const router = useRouter()
  const notifiedTokenIds = useState<string[]>('notifiedTokenIds', () => [])

  async function checkAndNotify(): Promise<{ needsAttention: number; expired: number; expiringSoon: number } | null> {
    try {
      const data = await $fetch<{
        accounts: Array<{ id: string; platform: string; accountName: string; health: { status: string; daysRemaining: number | null } }>
        summary: { needsAttention: number; expired: number; expiringSoon: number }
      }>('/api/v1/social-accounts/health')

      const expired = data.accounts.filter(
        a => a.health.status === 'expired' && !notifiedTokenIds.value.includes(a.id)
      )
      const expiringSoon = data.accounts.filter(
        a => a.health.status === 'expiring_soon' && !notifiedTokenIds.value.includes(a.id)
      )

      if (expired.length > 0) {
        const names = expired.map(a => a.accountName || a.platform).join(', ')
        toast.add({
          id: `token-expired-${Date.now()}`,
          title: `${expired.length} connection${expired.length > 1 ? 's' : ''} need${expired.length > 1 ? '' : 's'} reconnection`,
          description: `${names} — token${expired.length > 1 ? 's have' : ' has'} expired. Reconnect to avoid publish failures.`,
          color: 'error',
          icon: 'i-heroicons-exclamation-triangle',
          actions: [{
            label: 'Fix',
            onClick: () => router.push('/app/integrations')
          }]
        })
        notifiedTokenIds.value = [...new Set([...notifiedTokenIds.value, ...expired.map(a => a.id)])]
      }

      if (expiringSoon.length > 0) {
        const nearest = expiringSoon.sort((a, b) => (a.health.daysRemaining ?? 99) - (b.health.daysRemaining ?? 99)).slice(0, 3)
        const names = nearest.map(a => `${a.accountName || a.platform} (${a.health.daysRemaining}d)`).join(', ')
        toast.add({
          id: `token-expiring-${Date.now()}`,
          title: `${expiringSoon.length} token${expiringSoon.length > 1 ? 's' : ''} expiring soon`,
          description: names,
          color: 'warning',
          icon: 'i-heroicons-clock',
          actions: [{
            label: 'Review',
            onClick: () => router.push('/app/integrations')
          }]
        })
        notifiedTokenIds.value = [...new Set([...notifiedTokenIds.value, ...expiringSoon.map(a => a.id)])]
      }

      return data.summary
    } catch {
      return null
    }
  }

  return { checkAndNotify }
}
