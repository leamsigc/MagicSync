import type { BusinessProfile } from '#layers/BaseDB/db/schema'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export type BusinessStatus = 'active' | 'inactive'
export type BusinessSort = 'recent' | 'name' | 'newest'
export type BusinessView = 'grid' | 'list' | 'table'
export type BusinessStatusTone = 'success' | 'neutral'

/** Avatar swatches for the business initials tile. */
const AVATAR_COLORS = [
  'bg-violet-600',
  'bg-emerald-600',
  'bg-orange-600',
  'bg-sky-600',
  'bg-pink-600',
  'bg-amber-600',
  'bg-cyan-600',
  'bg-lime-600',
]

/**
 * Fields that count toward profile completeness. `name` is always present, so
 * a business with nothing else filled in still reads as a partial profile.
 */
const PROFILE_FIELDS: (keyof BusinessProfile)[] = [
  'name',
  'description',
  'address',
  'phone',
  'website',
  'category',
  'googleBusinessId',
]

export interface BusinessCompleteness {
  filled: number
  total: number
  percent: number
}

/**
 * Derives the presentation facts the business directory shows (status, profile
 * completeness, initials, human dates) from a `BusinessProfile`. Kept out of
 * the view so grid, list and table agree on every value.
 */
export const useBusinessDirectory = () => {
  const { t } = useI18n()

  const initial = (name: string): string => name.charAt(0).toUpperCase() || '?'
  const avatarColor = (name: string): string => AVATAR_COLORS[name.length % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!
  const status = (business: BusinessProfile): BusinessStatus => (business.isActive ? 'active' : 'inactive')
  const statusTone = (business: BusinessProfile): BusinessStatusTone => (business.isActive ? 'success' : 'neutral')
  const statusLabel = (business: BusinessProfile): string => t(business.isActive ? 'directory.status_active' : 'directory.status_inactive')

  const subtitle = (business: BusinessProfile): string =>
    business.description || business.website || business.category || ''

  const formattedDate = (value?: Date | string | null): string => (value ? dayjs(value).format('MMM D, YYYY') : '')
  const shortDate = (value?: Date | string | null): string => (value ? dayjs(value).format('MMM D') : '')
  const timeAgo = (value?: Date | string | null): string => (value ? dayjs(value).fromNow() : '')

  const completeness = (business: BusinessProfile): BusinessCompleteness => {
    const filled = PROFILE_FIELDS.filter(field => Boolean(business[field])).length
    const total = PROFILE_FIELDS.length
    return { filled, total, percent: Math.round((filled / total) * 100) }
  }

  const sortBusinesses = (list: BusinessProfile[], mode: BusinessSort): BusinessProfile[] => {
    const rows = [...list]
    if (mode === 'name') return rows.sort((a, b) => a.name.localeCompare(b.name))
    if (mode === 'newest') return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  return {
    initial,
    avatarColor,
    status,
    statusTone,
    statusLabel,
    subtitle,
    formattedDate,
    shortDate,
    timeAgo,
    completeness,
    sortBusinesses,
  }
}
