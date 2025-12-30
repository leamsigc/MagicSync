import type { BusinessProfile } from "#layers/BaseDB/db/schema";
import type { PaginatedResponse } from "#layers/BaseDB/server/services/types";
import { useBusinessManager } from "../pages/app/business/composables/useBusinessManager"

export default defineNuxtRouteMiddleware(async (to) => {

  const isUserNavigatingToTheApp = to.path.startsWith('/app')
  const isUserSettingUpFirstBusiness = to.path.startsWith('/app/business/initial')

  const { data } = await useFetch<ServiceResponse<BusinessProfile>>('/api/v1/business/active');
  const { data: businessesResponse } = await useFetch<PaginatedResponse<BusinessProfile>>('/api/v1/business');
  const { businesses } = useBusinessManager();
  const activeBusinessId = useState<string>('business:id');

  if (activeBusinessId.value) {
    return
  }

  if (data.value?.data?.id) {
    activeBusinessId.value = data.value.data.id;
  }
  if (businessesResponse.value) {
    businesses.value = businessesResponse.value;
  }

  if (isUserNavigatingToTheApp && !isUserSettingUpFirstBusiness && !businessesResponse.value?.data?.length) {
    return navigateTo('/app/business/initial');
  }

})
