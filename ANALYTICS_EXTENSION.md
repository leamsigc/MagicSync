# Analytics Extension Guide

## Overview

This document maps PostPlanify's per-platform tracking metrics to the existing plugin architecture in `@packages/scheduler/server/services/plugins/` and provides implementation guidance for extending each plugin to support comprehensive analytics. It also includes a section on implementing a browser extension for the project.

## PostPlanify Analytics Capabilities

Based on PostPlanify's features, the platform tracks the following metrics across 10 social media platforms:

### Instagram Analytics
- **Account Metrics**: Followers, reach, views, saves, shares
- **Post Performance**: Engagement rate, profile visits, new follows
- **Content Types**: Reels performance vs Stories vs Carousels
- **Advanced Metrics**: Reels watch time, story views, carousel interactions
- **Historical Trends**: 7, 14, 30, 90-day tracking
- **Best Posting Times**: Engagement heatmap

### TikTok Analytics
- **Video Metrics**: Views, likes, comments, shares, engagement rate
- **Account Growth**: Daily follower count snapshots, total likes tracking
- **Performance Analysis**: Historical trend charts, best posting times heatmap
- **Content Performance**: Video-by-video engagement breakdown

### X (Twitter) Analytics
- **Tweet Metrics**: Impressions, engagements, likes, retweets, replies
- **Follower Analytics**: Follower growth, follower demographics
- **Tweet Performance**: Top-performing tweets, engagement rate analysis
- **Twitter-Specific**: Quote tweets, tweet replies, media engagements

### YouTube Analytics
- **Channel Metrics**: Subscribers, video views, likes, comments
- **Content Format Performance**: Regular videos vs Shorts comparison
- **Historical Trends**: Week-over-week metric changes
- **Video-Specific**: Watch time, retention rates, audience demographics

### Facebook Analytics
- **Page Metrics**: Impressions, reach, engagement, follower growth
- **Post Performance**: Post engagements, reach, share count
- **Content Types**: Video posts, image posts, link posts performance
- **Advanced Insights**: Post-by-post analytics, time-based engagement

### LinkedIn Analytics
- **Profile/Page Metrics**: Followers, engagement, post reach
- **Content Performance**: Post engagement, share count, comment count
- **Professional Metrics**: Network growth, post impressions
- **Lead Generation**: Click-through rates, conversion tracking

### Pinterest Analytics
- **Pin Metrics**: Impressions, engagements, saves, clicks
- **Board Performance**: Board views, pin performance
- **Audience Insights**: Audience demographics, interest analysis
- **Content Reach**: Pin virality, repin tracking

### Threads Analytics
- **Post Metrics**: Likes, replies, reposts, quote posts
- **Account Growth**: Follower count, following count
- **Engagement Metrics**: Reply rate, repost rate
- **Content Performance**: Thread performance analysis

### Bluesky Analytics
- **Post Metrics**: Likes, reposts, replies, quote posts
- **Profile Metrics**: Follower count, following count
- **Engagement Rate**: Interaction tracking over time
- **Content Reach**: Post visibility, community engagement

### Google Business Analytics
- **Account Metrics**: Total impressions, search impressions, maps impressions
- **Post Metrics**: Website clicks, call clicks, direction requests, bookings
- **Platform-Specific**: Search keyword impressions, desktop vs mobile breakdown
- **Customer Actions**: Conversations, engagement rate tracking

## Current Plugin Architecture

### Base Plugin Structure

All plugins extend `BaseSchedulerPlugin` from `#layers/BaseScheduler/server/services/SchedulerPost.service` and implement the `getStatistic()` method that returns `PlatformStats`:

```typescript
export interface PlatformStats {
  platform: string
  accountId: string
  username: string
  picture?: string
  fetchedAt: string
  // Core social metrics
  followers?: number
  following?: number
  posts?: number
  // Engagement metrics
  engagement?: {
    total: number
    likes?: number
    comments?: number
    shares?: number
    views?: number
    reach?: number
    impressions?: number
  }
  // Growth metrics (change over last 7 days or available period)
  growth?: {
    followers?: { absolute: number; percentage: number }
    following?: { absolute: number; percentage: number }
    posts?: { absolute: number; percentage: number }
    engagement?: { absolute: number; percentage: number }
  }
  // Platform-specific extra data
  extra?: Record<string, unknown>
}
```

### Current Implementations

#### Facebook Plugin (Most Complete)
- **Status**: ✅ Full analytics implementation
- **API**: Facebook Graph API v25.0
- **Data Types**: `AnalyticsData` with label, percentageChange, data array
- **Metrics**: Followers, engagement, reach, growth tracking
- **Extension Points**: Already has comprehensive insights support

#### Instagram Plugin
- **Status**: ✅ Basic analytics via Facebook Graph API
- **API**: Facebook Graph API v25.0 insights endpoints
- **Missing**: Reels vs Stories breakdown, profile visits
- **Extension**: Add Instagram-specific insights endpoints

#### TikTok Plugin
- **Status**: ✅ Basic tracking
- **API**: TikTok Open API v2
- **Missing**: Video-specific metrics, engagement rate calculation
- **Extension**: Add video insights, follower growth tracking

#### YouTube Plugin
- **Status**: ✅ Channel-level analytics
- **API**: Google APIs
- **Missing**: Shorts vs regular video comparison
- **Extension**: Add format-specific metrics

#### X Plugin
- **Status**: ✅ Basic tweet metrics
- **API**: Twitter API v2
- **Missing**: Follower demographics, comprehensive engagement analysis
- **Extension**: Add advanced Twitter analytics endpoints

#### LinkedIn Plugin
- **Status**: ✅ Personal account only
- **Missing**: Page analytics, lead generation metrics
- **Extension**: Add LinkedIn Page API support

#### Google Business Plugin
- **Status**: ✅ Basic GMB support
- **Missing**: Search vs Maps breakdown, keyword impressions
- **Extension**: Add advanced GMB insights

#### Threads Plugin
- **Status**: ✅ Basic implementation
- **Missing**: Comprehensive thread performance
- **Extension**: Add Threads Graph API insights

#### Bluesky Plugin
- **Status**: ✅ Basic tracking
- **API**: @atproto/api
- **Missing**: Advanced engagement metrics
- **Extension**: Add Bluesky-specific analytics

#### Missing Platforms
- **Pinterest**: ❌ No existing plugin
- **Reddit**: ❌ Basic only
- **Dev.to**: ❌ No analytics
- **Discord**: ❌ No analytics
- **Dribbble**: ❌ No analytics
- **WordPress**: ❌ No analytics

## Plugin Extension Guide

### General Extension Pattern

To enhance any plugin for comprehensive analytics, follow this pattern:

```typescript
async getStatistic(
  postDetails: PostWithAllData,
  socialMediaAccount: SocialMediaAccount
): Promise<PlatformStats> {
  // 1. Fetch profile data
  // 2. Fetch platform-specific insights
  // 3. Calculate engagement metrics
  // 4. Compute growth data
  // 5. Return enhanced PlatformStats
}
```

### Platform-Specific Extensions

#### Instagram Plugin Enhancement

```typescript
// Add to instagram.plugin.ts
private async getInstagramInsights(
  accountId: string,
  accessToken: string,
  period: number = 7
): Promise<InsightData[]> {
  // Use Instagram Graph API insights endpoints
  // Add Reels vs Stories breakdown
  // Include profile visits and new follows
}

private async getReelsPerformance(
  accountId: string,
  accessToken: string
): Promise<ReelsData[]> {
  // Fetch Reels-specific metrics
  // Compare with Stories performance
}
```

#### TikTok Plugin Enhancement

```typescript
// Add to tiktok.plugin.ts
private async getTikTokVideoInsights(
  videoId: string,
  accessToken: string
): Promise<VideoInsights> {
  // Fetch video-specific metrics
  // Calculate engagement rate
  // Track watch time and completion rate
}

private async getFollowerGrowth(
  accountId: string,
  accessToken: string,
  period: number = 7
): Promise<GrowthData> {
  // Fetch daily follower snapshots
  // Calculate growth trends
}
```

#### YouTube Plugin Enhancement

```typescript
// Add to youtube.plugin.ts
private async getYoutubeChannelInsights(
  channelId: string,
  accessToken: string
): Promise<ChannelInsights> {
  // Fetch channel analytics from YouTube Data API
  // Separate Shorts vs regular video metrics
  // Include watch time and retention
}

private async getVideoPerformance(
  videoId: string,
  accessToken: string
): Promise<VideoPerformance> {
  // Fetch video-specific analytics
  // Include engagement metrics over time
}
```

#### X Plugin Enhancement

```typescript
// Add to x.plugin.ts
private async getTweetMetrics(
  tweetId: string,
  accessToken: string
): Promise<TweetInsights> {
  // Fetch detailed tweet analytics
  // Include impressions, engagements, replies
}

private async getFollowerDemographics(
  userId: string,
  accessToken: string
): Promise<DemographicsData> {
  // Fetch follower demographics if available
  // Include location, language data
}
```

#### Google Business Plugin Enhancement

```typescript
// Add to googlemybusiness.plugin.ts
private async getGoogleBusinessInsights(
  locationId: string,
  accessToken: string
): Promise<GMBInsights> {
  // Fetch GMB-specific insights
  // Separate search vs maps impressions
  // Include keyword performance data
}

private async getCustomerActions(
  locationId: string,
  accessToken: string
): Promise<CustomerActionsData> {
  // Track customer interactions
  // Include calls, directions, bookings
}
```

### New Plugin Implementations

#### Pinterest Plugin (New)

```typescript
// pinterest.plugin.ts
export class PinterestPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'pinterest';
  readonly pluginName = 'pinterest';

  async getStatistic(
    postDetails: PostWithAllData,
    socialMediaAccount: SocialMediaAccount
  ): Promise<PlatformStats> {
    // Implement Pinterest API integration
    // Track pin impressions, saves, clicks
    // Include board performance metrics
  }
}
```
