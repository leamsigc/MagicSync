import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export type IntegrationHealthStatus = 'healthy' | 'expiring_soon' | 'expired' | 'unknown'
export type IntegrationStatusTone = 'success' | 'warning' | 'error' | 'neutral'
export type IntegrationSort = 'recent' | 'name' | 'platform'
export type IntegrationView = 'grid' | 'list' | 'table'

export interface IntegrationHealth {
  status: IntegrationHealthStatus
  daysRemaining: number | null
}

/** A normalized connection so grid, list and table read one shape. */
export interface ConnectDirectoryItem {
  id: string
  name: string
  icon: string
  image?: string
  connected: boolean
  platform?: string
  accountId?: string
  createdAt?: Date | string | null
  tags?: string[]
  health?: IntegrationHealth
}

/** Worst-first ordering: an expired token outranks a healthy one. */
const HEALTH_RANK: Record<IntegrationHealthStatus, number> = {
  expired: 3,
  expiring_soon: 2,
  unknown: 1,
  healthy: 0,
}

const HEALTH_TONES: Record<IntegrationHealthStatus, IntegrationStatusTone> = {
  healthy: 'success',
  expiring_soon: 'warning',
  expired: 'error',
  unknown: 'neutral',
}

/**
 * Presentation facts for the integrations directory: token health (label,
 * tone, and the worst status across a provider's pages), dates and sorting.
 * Kept out of the views so grid, list and table agree.
 */
export const useIntegrationDirectory = () => {
  const { t } = useI18n()

  const healthStatus = (health?: IntegrationHealth | null): IntegrationHealthStatus => health?.status ?? 'unknown'
  const healthTone = (health?: IntegrationHealth | null): IntegrationStatusTone => HEALTH_TONES[healthStatus(health)]

  const healthLabel = (health?: IntegrationHealth | null): string => {
    const status = healthStatus(health)
    if (status === 'expiring_soon' && health?.daysRemaining != null) {
      return t('directory.health_expiring_days', { days: health.daysRemaining })
    }
    return t(`directory.health_${status}`)
  }

  const statusTone = (item: ConnectDirectoryItem): IntegrationStatusTone => {
    if (!item.connected) return 'neutral'
    return healthStatus(item.health) === 'unknown' ? 'success' : healthTone(item.health)
  }

  const statusLabel = (item: ConnectDirectoryItem): string => {
    if (!item.connected) return t('states.not_connected')
    return healthStatus(item.health) === 'unknown' ? t('states.connected') : healthLabel(item.health)
  }

  const formattedDate = (value?: Date | string | null): string => (value ? dayjs(value).format('MMM D, YYYY') : '')
  const timeAgo = (value?: Date | string | null): string => (value ? dayjs(value).fromNow() : '')

  /** The worst health across a provider's linked pages, or undefined. */
  const worstHealth = (healths: IntegrationHealth[]): IntegrationHealth | undefined =>
    healths.reduce<IntegrationHealth | undefined>(
      (worst, health) => (!worst || HEALTH_RANK[health.status] > HEALTH_RANK[worst.status] ? health : worst),
      undefined
    )

  const sortItems = (list: ConnectDirectoryItem[], mode: IntegrationSort): ConnectDirectoryItem[] => {
    const rows = [...list]
    if (mode === 'name') return rows.sort((a, b) => a.name.localeCompare(b.name))
    if (mode === 'platform') return rows.sort((a, b) => (a.platform ?? '').localeCompare(b.platform ?? ''))
    return rows.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
  }

  return {
    healthStatus,
    healthTone,
    healthLabel,
    statusTone,
    statusLabel,
    formattedDate,
    timeAgo,
    worstHealth,
    sortItems,
  }
}
