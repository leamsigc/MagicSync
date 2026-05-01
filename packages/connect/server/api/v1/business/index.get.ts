import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import type { PaginatedResponse } from '#layers/BaseDB/server/services/types';
import type { BusinessProfile } from '#layers/BaseDB/db/schema';


export default defineEventHandler(async (event): Promise<PaginatedResponse<BusinessProfile>> => {
  const log = useLogger(event)
  // Check user is login
  // Get user from session (assuming auth middleware sets this)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })
  //Get all the business for the current user
  const businesses = await businessProfileService.findByUserId(user.id)
  //return the business
  log.info('Business profiles listed', { count: businesses.data })
  return businesses;
});
