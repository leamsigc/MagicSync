import type { BusinessProfile } from "#layers/BaseDB/db/schema";
import type { PaginatedResponse, ServiceResponse } from "#layers/BaseDB/server/services/types";

/**
 * Route middleware runs on server (SSR) and client. Plain $fetch from Node
 * sends no browser cookies, so authenticated endpoints 401 during SSR while
 * the client-side retry succeeds. Forward cookies explicitly.
 */
async function apiFetch<T>(path: string): Promise<T> {
  return $fetch<T>(path, { headers: useRequestHeaders(['cookie']) })
}

async function fetchActiveBusinessId(): Promise<string | undefined> {
  try {
    const activeResult = await apiFetch<ServiceResponse<BusinessProfile>>('/api/v1/business/active');
    return activeResult?.data?.id;
  } catch {
    return undefined;
  }
}

async function fetchBusinessList(): Promise<PaginatedResponse<BusinessProfile> | undefined> {
  try {
    const response = await apiFetch<PaginatedResponse<BusinessProfile>>('/api/v1/business');
    if (!response?.data) return undefined;
    return response;
  } catch {
    return undefined;
  }
}

function pickFallbackActive(fetchedActiveId: string | undefined, list: BusinessProfile[]): string | undefined {
  if (fetchedActiveId) return fetchedActiveId;
  return list[0]?.id;
}

function shouldRedirectToSetup(path: string, listLoaded: boolean, hasBusinesses: boolean): boolean {
  if (path.startsWith('/app/business/initial')) return false;
  if (!listLoaded) return false;
  return !hasBusinesses;
}

export default defineNuxtRouteMiddleware(async (to) => {

  if (!to.path.startsWith('/app')) return

  const businesses = useState<PaginatedResponse<BusinessProfile>>('business:list', () => ({
    data: [] as BusinessProfile[],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  }))
  const activeBusinessId = useState<string | undefined>('business:id');

  const cachedIds = (businesses.value.data ?? []).map((business) => business.id)
  if (activeBusinessId.value && cachedIds.includes(activeBusinessId.value)) return

  const [fetchedActiveId, listResponse] = await Promise.all([
    fetchActiveBusinessId(),
    fetchBusinessList(),
  ])

  if (listResponse) {
    businesses.value = listResponse;
    activeBusinessId.value = pickFallbackActive(fetchedActiveId, listResponse.data ?? []);
  }

  const hasBusinesses = (businesses.value.data?.length ?? 0) > 0
  if (shouldRedirectToSetup(to.path, !!listResponse, hasBusinesses)) {
    return navigateTo('/app/business/initial');
  }

})
