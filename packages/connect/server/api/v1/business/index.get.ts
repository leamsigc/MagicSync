import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import type { PaginatedResponse } from '#layers/BaseDB/server/services/types';
import type { BusinessProfile } from '#layers/BaseDB/db/schema';


export default defineEventHandler(async (event): Promise<PaginatedResponse<BusinessProfile>> => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })
  // Includes both owned and org-membership businesses so invited members see the business
  const businesses = await businessProfileService.findByUserIdWithMembership(user.id)
  log.info({ message: 'Business profiles listed', count: businesses.data?.length ?? 0 })
  return businesses;
});
