export interface BasePlatformSettings {
    __type: string;
}

export interface TwitterSettings extends BasePlatformSettings {
    __type: 'twitter' | 'x';
    who_can_reply?: 'everyone' | 'following' | 'mentionedUsers' | 'subscribers' | 'verified';
    community?: string;
}

export interface FacebookSettings extends BasePlatformSettings {
    __type: 'facebook';
    url?: string;
}

export interface InstagramSettings extends BasePlatformSettings {
    __type: 'instagram' | 'instagram-standalone';
    post_type?: 'post' | 'story';
    collaborators?: Array<{ label: string }>;
}

export interface LinkedInSettings extends BasePlatformSettings {
    __type: 'linkedin' | 'linkedin-page';
    post_as_images_carousel?: boolean;
}

export interface GoogleBusinessSettings extends BasePlatformSettings {
    __type: 'gmb';
    topicType?: 'STANDARD' | 'EVENT' | 'OFFER';
    callToActionType?: 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL';
    callToActionUrl?: string;
    eventTitle?: string;
    eventStartDate?: string;
    eventEndDate?: string;
    eventStartTime?: string;
    eventEndTime?: string;
    offerCouponCode?: string;
    offerRedeemUrl?: string;
    offerTerms?: string;
}

export interface RedditSubreddit {
    value: string;
    title: string;
    type: string;
    url: string;
    is_flair_required: boolean;
    flair?: {
        id: string;
        name: string;
    };
}

export interface RedditSettings extends BasePlatformSettings {
    __type: 'reddit';
    subreddit?: RedditSubreddit;
    type?: 'self' | 'link' | 'image' | 'video';
    url?: string;
}

export interface DevToSettings extends BasePlatformSettings {
    __type: 'devto';
    title: string;
    main_image?: {
        id: string;
        path: string;
    };
    canonical?: string;
    organization?: string;
    tags?: Array<{ value: string; label: string }>;
}

export interface WordPressSettings extends BasePlatformSettings {
    __type: 'wordpress';
    title: string;
    main_image?: {
        id: string;
        path: string;
    };
    type?: string;
}

export interface TikTokSettings extends BasePlatformSettings {
    __type: 'tiktok';
    privacy_level?: 'PUBLIC' | 'FRIENDS_ONLY' | 'SELF_ONLY';
    disable_duet?: boolean;
    disable_comment?: boolean;
    disable_stitch?: boolean;
    video_cover_timestamp_ms?: number;
}

export interface BlueskySettings extends BasePlatformSettings {
    __type: 'bluesky';
    contentWarning?: string;
    languages?: string[];
}

export interface ThreadsSettings extends BasePlatformSettings {
    __type: 'threads';
    hide_likes?: boolean;
    who_can_reply?: 'everyone' | 'profiles_you_follow' | 'mentioned_only';
}

export interface YouTubeSettings extends BasePlatformSettings {
    __type: 'youtube';
    title: string;
    privacyStatus?: 'public' | 'private' | 'unlisted';
    madeForKids?: boolean;
    tags?: string[];
    categoryId?: string;
    thumbnailUrl?: string;
}

export interface DiscordSettings extends BasePlatformSettings {
    __type: 'discord';
    channelId?: string;
    embeds?: any[];
}

export interface DribbbleSettings extends BasePlatformSettings {
    __type: 'dribbble';
    title: string;
    tags?: string[];
    low_profile?: boolean;
    rebound_source_id?: string;
    team_id?: string;
    scheduled_for?: string;
}

export type PlatformSettings =
    | TwitterSettings
    | FacebookSettings
    | InstagramSettings
    | LinkedInSettings
    | GoogleBusinessSettings
    | RedditSettings
    | DevToSettings
    | WordPressSettings
    | TikTokSettings
    | BlueskySettings
    | ThreadsSettings
    | YouTubeSettings
    | DiscordSettings
    | DribbbleSettings;

export type PlatformSettingsMap = {
    twitter: TwitterSettings;
    x: TwitterSettings;
    facebook: FacebookSettings;
    instagram: InstagramSettings;
    'instagram-standalone': InstagramSettings;
    linkedin: LinkedInSettings;
    'linkedin-page': LinkedInSettings;
    google: GoogleBusinessSettings;
    reddit: RedditSettings;
    devto: DevToSettings;
    wordpress: WordPressSettings;
    tiktok: TikTokSettings;
    bluesky: BlueskySettings;
    threads: ThreadsSettings;
    youtube: YouTubeSettings;
    discord: DiscordSettings;
    dribbble: DribbbleSettings;
};

export function createDefaultSettings(platform: string): PlatformSettings | null {
    switch (platform) {
        case 'twitter':
        case 'x':
            return { __type: platform, who_can_reply: 'everyone' };
        case 'facebook':
            return { __type: 'facebook' };
        case 'instagram':
        case 'instagram-standalone':
            return { __type: platform, post_type: 'post', collaborators: [] };
        case 'linkedin':
        case 'linkedin-page':
            return { __type: platform, post_as_images_carousel: false };
        case 'google':
            return { __type: 'gmb', topicType: 'STANDARD' };
        case 'reddit':
            return { __type: 'reddit', type: 'self' };
        case 'devto':
            return { __type: 'devto', title: '', tags: [] };
        case 'wordpress':
            return { __type: 'wordpress', title: '', type: 'post' };
        case 'tiktok':
            return {
                __type: 'tiktok',
                privacy_level: 'PUBLIC',
                disable_comment: false,
                disable_duet: false,
                disable_stitch: false
            };
        case 'bluesky':
            return { __type: 'bluesky', languages: ['en'] };
        case 'threads':
            return { __type: 'threads', hide_likes: false, who_can_reply: 'everyone' };
        case 'youtube':
            return { __type: 'youtube', title: '', privacyStatus: 'public', madeForKids: false };
        case 'discord':
            return { __type: 'discord' };
        case 'dribbble':
            return { __type: 'dribbble', title: '' };
        default:
            return null;
    }
}
