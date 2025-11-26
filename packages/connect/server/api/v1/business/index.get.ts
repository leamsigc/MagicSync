import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import type { PaginatedResponse } from '#layers/BaseDB/server/services/types';
import type { BusinessProfile } from '#layers/BaseDB/db/schema';


export default defineEventHandler(async (event): Promise<PaginatedResponse<BusinessProfile>> => {
  // Check user is login
  // Get user from session (assuming auth middleware sets this)
  const user = await checkUserIsLogin(event)
  //Get all the business for the current user
  const businesses = await businessProfileService.findByUserId(user.id)
  //return the business
  return businesses;
});
