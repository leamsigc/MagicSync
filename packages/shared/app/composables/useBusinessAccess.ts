export type BusinessRole = 'owner' | 'member'

/** Minimal business shape the composable needs; avoids a shared→db type import. */
export interface BusinessAccessBusiness {
  id: string
  name?: string
  userId?: string
  [key: string]: unknown
}

export interface BusinessAccessState {
  role: BusinessRole
  business?: BusinessAccessBusiness
}

/**
 * Client-side mirror of the server's business access resolver.
 *
 * The server is the authority (every write route re-checks), but the UI needs
 * to hide owner-only actions instead of letting a member click into a 403.
 * The resolved role is cached per business for the session.
 */
export const useBusinessAccess = (businessId?: MaybeRefOrGetter<string | undefined>) => {
  const activeBusinessId = useState<string | undefined>('business:id')
  const cache = useState<Record<string, BusinessAccessState>>('business:access', () => ({}))

  const id = computed(() => toValue(businessId) ?? activeBusinessId.value)

  const state = computed(() => (id.value ? cache.value[id.value] : undefined))
  const role = computed<BusinessRole | undefined>(() => state.value?.role)
  const isOwner = computed(() => role.value === 'owner')
  const isMember = computed(() => role.value === 'member')
  const canManage = computed(() => isOwner.value)
  const canEditContent = computed(() => !!role.value)

  const load = async (): Promise<BusinessAccessState | undefined> => {
    const businessIdValue = id.value
    if (!businessIdValue) return undefined
    const cached = cache.value[businessIdValue]
    if (cached) return cached

    try {
      const response = await $fetch<{ data: BusinessAccessBusiness, role: BusinessRole }>(`/api/v1/business/${businessIdValue}`)
      const next = { role: response.role, business: response.data }
      cache.value = { ...cache.value, [businessIdValue]: next }
      return next
    }
    catch {
      return undefined
    }
  }

  return {
    id,
    state,
    role,
    isOwner,
    isMember,
    canManage,
    canEditContent,
    load,
  }
}
