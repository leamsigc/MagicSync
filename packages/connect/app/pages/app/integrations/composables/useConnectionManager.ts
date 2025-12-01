import type { FacebookPage } from '#layers/BaseConnect/utils/FacebookPages';

import { linkSocial } from "#layers/BaseAuth/lib/auth-client";
import type { SocialMediaAccount, SocialMediaComplete } from "#layers/BaseDB/db/schema";
import { useBusinessManager } from "../../business/composables/useBusinessManager";

export interface Connection {
  name: string;
  icon: string;
  url: string;
  platform: 'facebook' | 'instagram' | 'instagram-standalone' | 'twitter' | 'tiktok' | 'google' | 'googlemybusiness' | 'discord' | 'linkedin' | 'linkedin-page' | 'threads' | 'youtube' | 'bluesky' | 'devto' | 'dribbble' | 'reddit' | 'wordpress';
  authType?: 'better-auth' | 'manual-oauth' | 'api-key';
}


const connectionList = ref<Connection[]>([]);

export const useConnectionManager = () => {
  const toast = useToast();
  const allConnections = ref<SocialMediaAccount[]>([]);
  const pagesList = useState<SocialMediaComplete[]>("socialMedia:List", () => []);
  const facebookPages = ref<FacebookPage[]>([]);
  const router = useRouter();
  const setConnectionList = () => {
    connectionList.value = [
      // Better Auth OAuth platforms (native support)
      { name: 'Facebook', icon: 'logos:facebook', url: '#', platform: 'facebook', authType: 'better-auth' },
      { name: 'Instagram', icon: 'logos:instagram-icon', url: '#', platform: "instagram", authType: 'better-auth' },
      { name: 'Threads', icon: 'fa6-brands:square-threads', url: '#', platform: "threads", authType: 'better-auth' },
      { name: 'Google Business', icon: 'logos:google', url: '#', platform: "googlemybusiness", authType: 'better-auth' },
      { name: 'LinkedIn', icon: 'logos:linkedin-icon', url: '#', platform: "linkedin", authType: 'better-auth' },
      { name: 'X (Twitter)', icon: 'logos:twitter', url: '#', platform: "twitter", authType: 'better-auth' },
      { name: 'TikTok', icon: 'logos:tiktok-icon', url: '#', platform: "tiktok", authType: 'better-auth' },
      { name: 'Discord', icon: 'logos:discord-icon', url: '#', platform: "discord", authType: 'better-auth' },
      { name: 'Reddit', icon: 'logos:reddit-icon', url: '#', platform: "reddit", authType: 'better-auth' },
      { name: 'YouTube', icon: 'logos:youtube-icon', url: '#', platform: "youtube", authType: 'better-auth' },

      // Better Auth Generic OAuth platforms
      { name: 'LinkedIn Page', icon: 'logos:linkedin-icon', url: '#', platform: "linkedin-page", authType: 'better-auth' },
      { name: 'Dribbble', icon: 'logos:dribbble-icon', url: '#', platform: "dribbble", authType: 'better-auth' },

      // API Key / Credential-based platforms
      { name: 'Bluesky', icon: 'fa6-brands:bluesky', url: '#', platform: "bluesky", authType: 'api-key' },
      { name: 'Dev.to', icon: 'logos:dev-badge', url: '#', platform: "devto", authType: 'api-key' },
      { name: 'WordPress', icon: 'logos:wordpress-icon', url: '#', platform: "wordpress", authType: 'api-key' },
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
          console.log("######## Connect to Bluesky #######");
          console.log(response);
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

      if (connectionId === 'facebook') {
        facebookPages.value = (response as unknown as FacebookPage[])
      }
    } catch (error) {
      console.error('Error adding business:', error);
      throw error;
    }
  }
  const getAllSocialMediaAccounts = async () => {
    try {
      const response = await $fetch<Promise<SocialMediaComplete[]>>('/api/v1/social-accounts');
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
      console.log("######## Connect to Facebook #######");
      console.log(res);

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

  return {
    connectionList,
    allConnections,
    pagesList,
    facebookPages,
    setConnectionList,
    getAllConnections,
    HandleConnectTo,
    getPagesForIntegration,
    HandleConnectToFacebook,
    getAllSocialMediaAccounts
  }
};
