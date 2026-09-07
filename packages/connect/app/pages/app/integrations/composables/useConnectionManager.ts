import type { FacebookPage } from '#layers/BaseConnect/utils/FacebookPages';

import { linkSocial } from "#layers/BaseAuth/lib/auth-client";
import type { AccountComplete, SocialMediaAccount, SocialMediaComplete } from "#layers/BaseDB/db/schema";
import { useBusinessManager } from "../../business/composables/useBusinessManager";

export interface Connection {
  name: string;
  icon: string;
  url: string;
  platform: 'facebook' | 'instagram' | 'instagram-standalone' | 'twitter' | 'tiktok' | 'google' | 'googlemybusiness' | 'discord' | 'linkedin' | 'linkedin-page' | 'threads' | 'youtube' | 'bluesky' | 'devto' | 'dribbble' | 'reddit' | 'wordpress';
  authType?: 'better-auth' | 'manual-oauth' | 'api-key';
  active?: boolean
}


const connectionList = ref<Connection[]>([]);

export const useConnectionManager = () => {

  const { t } = useI18n();
  const toast = useToast();
  const allConnections = ref<SocialMediaAccount[]>([]);
  const pagesList = useState<SocialMediaComplete[]>("socialMedia:List", () => []);
  const accountsList = useState<AccountComplete[]>("accounts:List", () => []);
  const facebookPages = ref<FacebookPage[]>([]);
  const router = useRouter();
  const activeBusinessId = ref<string>('');
  const setConnectionList = () => {
    connectionList.value = [
      // Better Auth OAuth platforms (native support)
      { name: 'Facebook', icon: 'logos:facebook', url: '#', platform: 'facebook', authType: 'better-auth', active: true },
      // NOTE: no generic 'Google' card — Google login is identity-only
      // (Google rejects scope bundles). YouTube, Google Business and Drive
      // are connected separately via incremental auth below.
      { name: 'Google Business', icon: 'logos:google-icon', url: '#', platform: "googlemybusiness", authType: 'manual-oauth', active: true },
      { name: 'LinkedIn', icon: 'logos:linkedin-icon', url: '#', platform: "linkedin", authType: 'better-auth', active: true },
      { name: 'X (Twitter)', icon: 'logos:twitter', url: '#', platform: "twitter", authType: 'better-auth', active: true },
      { name: 'TikTok', icon: 'logos:tiktok-icon', url: '#', platform: "tiktok", authType: 'better-auth', active: false },
      { name: 'Discord', icon: 'logos:discord-icon', url: '#', platform: "discord", authType: 'better-auth', active: false },
      { name: 'Reddit', icon: 'logos:reddit-icon', url: '#', platform: "reddit", authType: 'better-auth', active: false },
      { name: 'YouTube', icon: 'logos:youtube-icon', url: '#', platform: "youtube", authType: 'manual-oauth', active: true },

      // Better Auth Generic OAuth platforms
      { name: 'Instagram', icon: 'logos:instagram-icon', url: '#', platform: "instagram", authType: 'manual-oauth', active: true },
      { name: 'LinkedIn Page', icon: 'logos:linkedin-icon', url: '#', platform: "linkedin-page", authType: 'manual-oauth', active: true },
      { name: 'Threads', icon: 'fa6-brands:square-threads', url: '#', platform: "threads", authType: 'manual-oauth', active: true },
      { name: 'Dribbble', icon: 'logos:dribbble-icon', url: '#', platform: "dribbble", authType: 'manual-oauth', active: false },

      // API Key / Credential-based platforms
      { name: 'Bluesky', icon: 'fa6-brands:bluesky', url: '#', platform: "bluesky", authType: 'api-key', active: true },
      { name: 'Dev.to', icon: 'simple-icons:devdotto', url: '#', platform: "devto", authType: 'api-key', active: false },
      { name: 'WordPress', icon: 'logos:wordpress-icon', url: '#', platform: "wordpress", authType: 'api-key', active: false },
    ]
  }
  const getAllConnections = async (connections: SocialMediaAccount[]) => {
    allConnections.value = connections
  }
  const HandleConnectTo = async (connection: Connection, credentials?: { [key: string]: string }) => {
    try {
      const { activeBusinessId } = useBusinessManager()

      if (connection.authType === 'better-auth') {
        linkSocial({
          provider: connection.platform,
          callbackURL: `/api/v1/social-accounts/callback/${connection.platform}?businessId=${activeBusinessId.value}`,
        });
      } else if (connection.authType === 'api-key') {
        if (connection.platform == 'bluesky') {
          const response = await $fetch<Promise<SocialMediaAccount>>(`/api/v1/social-accounts/api-key/bluesky?businessId=${activeBusinessId.value}`, {
            method: 'POST',
            body: { ...credentials, ...connection, platformId: connection.platform, businessId: activeBusinessId.value },
          });
          toast.add({
            title: 'Success',
            description: 'Successfully connected to Bluesky',
            icon: 'i-heroicons-check-circle',
            color: 'success',
          });
          await getAllSocialMediaAccounts();
          router.push('/app/integrations/active')
          return response
        }
        // Show modal for API key/credential input
        toast.add({
          title: 'API Key Required',
          description: `Please configure ${connection.name} credentials in settings`,
          icon: 'i-heroicons-information-circle',
          color: 'info',
        });
      } else if (connection.authType === 'manual-oauth') {
        linkSocial({
          provider: connection.platform,
          callbackURL: `/api/v1/social-accounts/callback/${connection.platform}?businessId=${activeBusinessId.value}`,
        })
      }

    } catch (error) {
      console.error('Error connecting to platform:', error);
      toast.add({
        title: 'Connection Failed',
        description: `Failed to connect to ${connection.name}`,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      });
      throw error;
    }
  }
  const getPagesForIntegration = async (connectionId: string) => {
    try {
      const response = await $fetch<Promise<SocialMediaAccount[]>>('/api/v1/social-accounts?platformId=' + connectionId);

      if (connectionId === 'facebook' || connectionId === 'linkedin-page' || connectionId === 'youtube' || connectionId === 'google') {
        facebookPages.value = (response as unknown as FacebookPage[])
      }
    } catch (error) {
      console.error('Error adding business:', error);
      toast.add({
        title: 'Failed to Fetch Pages',
        description: `Could not retrieve pages for ${connectionId}. The token may have expired. Try reconnecting.`,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      });
      throw error;
    }
  }
  const getAllSocialMediaAccounts = async (businessId?: string) => {
    try {
      const targetBusinessId = businessId || useBusinessManager().activeBusinessId.value
      const url = targetBusinessId
        ? `/api/v1/social-accounts?businessId=${targetBusinessId}`
        : '/api/v1/social-accounts'
      const response = await $fetch<Promise<SocialMediaComplete[]>>(url);
      pagesList.value = response
    } catch (error) {
      console.error('Error adding business:', error);
      throw error;
    }
  }
  const HandleConnectToFacebook = async (page: FacebookPage) => {
    try {
      const { activeBusinessId } = useBusinessManager()
      const res = await $fetch<Promise<SocialMediaAccount>>(`/api/v1/social-accounts/facebook/${page.id}`, {
        method: 'POST',
        body: { ...page, platformId: 'facebook', businessId: activeBusinessId.value },
      });
      toast.add({
        title: 'Success',
        description: 'Successfully connected to Facebook page ' + page.name,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      });

      await getAllSocialMediaAccounts();

    } catch (error) {
      console.error('Error adding business:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to connect to Facebook page ' + page.name,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      });
      throw error;
    }
  }
  const HandleConnectToLinkedIn = async (page: FacebookPage) => {
    try {
      const { activeBusinessId } = useBusinessManager()
      const res = await $fetch<Promise<SocialMediaAccount>>(`/api/v1/social-accounts/linkedin-page/${page.id}`, {
        method: 'POST',
        body: { ...page, platformId: 'linkedin-page', businessId: activeBusinessId.value },
      });
      toast.add({
        title: 'Success',
        description: 'Successfully connected to LinkedIn page ' + page.name,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      });

      await getAllSocialMediaAccounts();

    } catch (error) {
      console.error('Error adding business:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to connect to LinkedIn page ' + page.name,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      });
      throw error;
    }
  }

  const HandleConnectToYoutube = async (page: FacebookPage & { platformType?: string }) => {
    try {
      const { activeBusinessId } = useBusinessManager()
      const res = await $fetch<Promise<SocialMediaAccount>>(`/api/v1/social-accounts/youtube/${page.id}`, {
        method: 'POST',
        body: { ...page, platformId: 'youtube', businessId: activeBusinessId.value },
      });
      toast.add({
        title: 'Success',
        description: 'Successfully connected to YouTube channel ' + page.name,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      });

      await getAllSocialMediaAccounts();
    } catch (error) {
      console.error('Error connecting YouTube channel:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to connect to YouTube channel ' + page.name,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      });
      throw error;
    }
  }
  const HandleConnectToGMB = async (page: FacebookPage & { platformType?: string }) => {
    try {
      const { activeBusinessId } = useBusinessManager()
      // GMB location ids are resource names (`accounts/.../locations/...`)
      // containing slashes — encode so they stay a single route segment.
      const res = await $fetch<Promise<SocialMediaAccount>>(`/api/v1/social-accounts/googlemybusiness/${encodeURIComponent(page.id)}`, {
        method: 'POST',
        body: { ...page, platformId: 'googlemybusiness', businessId: activeBusinessId.value },
      });
      toast.add({
        title: 'Success',
        description: 'Successfully connected to GMB location ' + page.name,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      });

      await getAllSocialMediaAccounts();
    } catch (error) {
      console.error('Error connecting GMB location:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to connect to GMB location ' + page.name,
        icon: 'i-heroicons-x-circle',
        color: 'error',
      });
      throw error;
    }
  }

  const getAllAccountDetails = async () => {
    try {
      const response = await $fetch<Promise<AccountComplete[]>>('/api/v1/accounts');
      accountsList.value = response
    } catch (error) {
      console.error('Error adding business:', error);
      throw error;
    }
  }


  const handleDisconnect = async (id: string) => {
    try {
      await $fetch(`/api/v1/social-accounts/${id}`, {
        method: 'DELETE' as any,
      });
      await getAllSocialMediaAccounts();
      toast.add({
        title: t('messages.disconnected.title'),
        description: t('messages.disconnected.description'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } catch (error) {
      toast.add({
        title: t('messages.error.title'),
        description: t('messages.error.description', { error, id }),
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
      console.error(`Error deleting business with ID ${id}:`, error);
      throw error;
    }
  }

  const HandleReconnect = async (accountId: string, platform: string) => {
    try {
      const response = await $fetch<{ success: boolean; data: { hasValidToken: boolean } }>(
        `/api/v1/social-accounts/refresh/${accountId}`,
        { method: 'POST' }
      );
      if (response.success) {
        toast.add({
          title: 'Token Refreshed',
          description: `Successfully refreshed ${platform} token`,
          icon: 'i-heroicons-check-circle',
          color: 'success',
        });
        await getAllSocialMediaAccounts();
      }
    } catch (error) {
      toast.add({
        title: 'Reconnect Failed',
        description: 'Failed to refresh token. Please reconnect the account.',
        icon: 'i-heroicons-x-circle',
        color: 'error',
      });
      throw error;
    }
  }

  const getTokenHealth = async (businessId?: string) => {
    try {
      const url = businessId ? `/api/v1/social-accounts/health?businessId=${businessId}` : '/api/v1/social-accounts/health'
      const response = await $fetch<{ accounts: Array<{ id: string; platform: string; health: { status: string; expiresAt: Date | null; daysRemaining: number | null } }>; summary: any }>(url)
      return response
    } catch (error) {
      console.error('Failed to fetch token health:', error)
      return null
    }
  }

  return {
    connectionList,
    allConnections,
    pagesList,
    facebookPages,
    accountsList,
    activeBusinessId,
    handleDisconnect,
    setConnectionList,
    getAllConnections,
    HandleConnectTo,
    getPagesForIntegration,
    HandleConnectToFacebook,
    HandleConnectToLinkedIn,
    HandleConnectToYoutube,
    HandleConnectToGMB,
    getAllSocialMediaAccounts,
    getAllAccountDetails,
    HandleReconnect,
    getTokenHealth,
  }
};
