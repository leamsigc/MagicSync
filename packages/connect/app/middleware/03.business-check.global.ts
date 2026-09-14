import type { BusinessProfile } from "#layers/BaseDB/db/schema";
import type { PaginatedResponse, ServiceResponse } from "#layers/BaseDB/server/services/types";

export default defineNuxtRouteMiddleware(async (to) => {

  const isUserNavigatingToTheApp = to.path.startsWith('/app')
  const isUserSettingUpFirstBusiness = to.path.startsWith('/app/business/initial')
  if (!isUserNavigatingToTheApp) return

  const businesses = useState<PaginatedResponse<BusinessProfile>>('business:list', () => ({
    data: [] as BusinessProfile[],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  }))
  const activeBusinessId = useState<string>('business:id');

  if (activeBusinessId.value) {
    return
  }

  try {
    const activeResult = await $fetch<ServiceResponse<BusinessProfile>>('/api/v1/business/active');
    if (activeResult?.data?.id) {
      activeBusinessId.value = activeResult.data.id;
    }
  } catch {}

  let businessesResponse: PaginatedResponse<BusinessProfile> | null = null
  try {
    businessesResponse = await $fetch<PaginatedResponse<BusinessProfile>>('/api/v1/business');
    businesses.value = businessesResponse;
  } catch {}

  if (isUserNavigatingToTheApp && !isUserSettingUpFirstBusiness && !businessesResponse?.data?.length) {
    return navigateTo('/app/business/initial');
  }

})
