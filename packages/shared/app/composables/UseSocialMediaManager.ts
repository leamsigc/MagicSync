import type { SocialMediaComplete } from "#layers/BaseDB/db/schema";


export const useSocialMediaManager = () => {

  const connectedSocialAccountsList = useState<SocialMediaComplete[]>("socialMedia:List", () => []);

  /**
   * Accounts for one business when `businessId` is given (the composer must not
   * offer accounts that belong to another business), else every account the
   * user owns.
   */
  const getAllSocialMediaAccounts = async (businessId?: string | null) => {
    try {
      const response = await $fetch<SocialMediaComplete[]>('/api/v1/social-accounts', {
        query: businessId ? { businessId } : undefined,
      });
      connectedSocialAccountsList.value = Array.isArray(response) ? response : [];
    } catch (error) {
      log.error({ message: 'Error loading social accounts', error: String(error) });
      throw error;
    }
  }


  return {
    getAllSocialMediaAccounts,
    connectedSocialAccountsList
  }

}
