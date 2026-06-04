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

## Browser Extension Implementation

### Overview

A browser extension can enhance the analytics capabilities by:

1. **Real-time data collection** from social media platforms
2. **Cross-platform aggregation** in the browser
3. **Enhanced tracking** for posts not published through the platform
4. **User interaction tracking** (clicks, hovers, time spent)

### Architecture

#### Extension Components

```
browser-extension/
├── manifest.json          # Extension manifest
├── background/            # Background scripts
│   ├── background.js
│   └── analytics-collector.js
├── content/               # Content scripts
│   ├── content.js
│   └── inject-analytics.js
├── popup/                 # Popup UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/               # Options page
│   ├── options.html
│   └── options.js
└── lib/                   # Shared utilities
    ├── api-client.js
    └── storage.js
```

#### Manifest.json

```json
{
  "manifest_version": 3,
  "name": "Social Analytics Extension",
  "version": "1.0.0",
  "description": "Enhanced social media analytics tracking",
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "tabs"
  ],
  "host_permissions": [
    "*://*.instagram.com/*",
    "*://*.tiktok.com/*",
    "*://*.twitter.com/*",
    "*://*.youtube.com/*",
    "*://*.facebook.com/*",
    "*://*.linkedin.com/*",
    "*://*.pinterest.com/*",
    "*://*.threads.net/*",
    "*://*.bsky.app/*",
    "*://*.google.com/*"
  ],
  "background": {
    "service_worker": "background/background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://*.instagram.com/*", "*://*.tiktok.com/*", "*://*.twitter.com/*"],
      "js": ["content/content.js"]
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "Social Analytics"
  },
  "options_page": "options/options.html"
}
```

#### Analytics Collector (Background Script)

```javascript
// background/analytics-collector.js
class AnalyticsCollector {
  constructor() {
    this.platforms = ['instagram', 'tiktok', 'twitter', 'youtube', 'facebook'];
    this.initializeTracking();
  }

  initializeTracking() {
    // Listen for tab updates to track page navigation
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.trackPageVisit(tab);
      }
    });

    // Track user interactions
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'trackInteraction') {
        this.trackUserInteraction(request.data);
      }
    });
  }

  async trackPageVisit(tab) {
    const url = new URL(tab.url);
    const platform = this.detectPlatform(url.hostname);
    
    if (platform) {
      const analyticsData = await this.extractPageAnalytics(tab.id, platform);
      await this.saveAnalyticsData(analyticsData);
    }
  }

  detectPlatform(hostname) {
    const platformMap = {
      'instagram.com': 'instagram',
      'tiktok.com': 'tiktok',
      'twitter.com': 'twitter',
      'youtube.com': 'youtube',
      'facebook.com': 'facebook',
      'linkedin.com': 'linkedin',
      'pinterest.com': 'pinterest',
      'threads.net': 'threads',
      'bsky.app': 'bluesky'
    };
    return platformMap[hostname];
  }

  async extractPageAnalytics(tabId, platform) {
    // Execute content script to extract page data
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      function: this.extractPageData,
      args: [platform]
    });

    return results[0].result;
  }

  extractPageData(platform) {
    // Platform-specific data extraction
    const pageData = {
      platform,
      url: window.location.href,
      timestamp: Date.now(),
      title: document.title,
      // Platform-specific metrics
      metrics: this.getPlatformMetrics(platform)
    };

    return pageData;
  }

  getPlatformMetrics(platform) {
    switch (platform) {
      case 'instagram':
        return this.extractInstagramMetrics();
      case 'tiktok':
        return this.extractTikTokMetrics();
      case 'twitter':
        return this.extractTwitterMetrics();
      case 'youtube':
        return this.extractYoutubeMetrics();
      default:
        return {};
    }
  }

  extractInstagramMetrics() {
    return {
      followers: this.extractNumber('.x1lliihq span'),
      likes: this.extractNumber('[aria-label*="like"]'),
      comments: this.extractNumber('[aria-label*="comment"]'),
      views: this.extractNumber('[aria-label*="view"]')
    };
  }

  extractNumber(selector) {
    const element = document.querySelector(selector);
    return element ? parseInt(element.textContent.replace(/,/g, '')) : 0;
  }

  async saveAnalyticsData(data) {
    // Save to chrome storage or send to backend
    chrome.storage.local.get(['analyticsData'], (result) => {
      const analyticsData = result.analyticsData || [];
      analyticsData.push(data);
      chrome.storage.local.set({ analyticsData });
    });
  }
}

new AnalyticsCollector();
```

#### Content Script

```javascript
// content/content.js
class ContentScript {
  constructor() {
    this.platform = this.detectPlatform();
    this.initializeTracking();
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    // Platform detection logic
    if (hostname.includes('instagram.com')) return 'instagram';
    if (hostname.includes('tiktok.com')) return 'tiktok';
    if (hostname.includes('twitter.com')) return 'twitter';
    if (hostname.includes('youtube.com')) return 'youtube';
    return null;
  }

  initializeTracking() {
    if (!this.platform) return;

    // Track post interactions
    this.trackPostInteractions();
    
    // Track scroll events
    this.trackScrollEvents();
    
    // Track time on page
    this.trackTimeOnPage();
  }

  trackPostInteractions() {
    // Listen for clicks on posts/elements
    document.addEventListener('click', (event) => {
      const postElement = this.findPostElement(event.target);
      if (postElement) {
        this.sendInteraction({
          type: 'post_click',
          postId: this.extractPostId(postElement),
          timestamp: Date.now()
        });
      }
    });
  }

  trackScrollEvents() {
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollDepth = this.getScrollDepth();
        this.sendInteraction({
          type: 'scroll',
          depth: scrollDepth,
          timestamp: Date.now()
        });
      }, 100);
    });
  }

  trackTimeOnPage() {
    let startTime = Date.now();
    window.addEventListener('beforeunload', () => {
      const timeOnPage = Date.now() - startTime;
      this.sendInteraction({
        type: 'time_on_page',
        duration: timeOnPage,
        timestamp: Date.now()
      });
    });
  }

  findPostElement(element) {
    // Logic to find the post container element
    return element.closest('[data-testid="post"], [role="article"], .post');
  }

  extractPostId(element) {
    // Extract unique post identifier
    return element.getAttribute('data-id') || element.id;
  }

  getScrollDepth() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    return Math.round((scrollTop / docHeight) * 100);
  }

  sendInteraction(data) {
    chrome.runtime.sendMessage({
      type: 'trackInteraction',
      data
    });
  }
}

new ContentScript();
```

#### Popup UI

```html
<!-- popup/popup.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Social Analytics</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .metric { margin: 10px 0; }
    .chart { width: 100%; height: 200px; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <h2>Analytics Overview</h2>
  <div id="metrics"></div>
  <canvas id="trendChart" class="chart"></canvas>
  
  <script src="popup.js"></script>
</body>
</html>
```

```javascript
// popup/popup.js
class Popup {
  constructor() {
    this.metrics = document.getElementById('metrics');
    this.chart = document.getElementById('trendChart');
    this.loadAnalytics();
  }

  async loadAnalytics() {
    const data = await this.getAnalyticsData();
    this.displayMetrics(data);
    this.drawChart(data);
  }

  async getAnalyticsData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['analyticsData'], (result) => {
        resolve(result.analyticsData || []);
      });
    });
  }

  displayMetrics(data) {
    const platformStats = this.aggregateByPlatform(data);
    
    Object.entries(platformStats).forEach(([platform, stats]) => {
      const metricDiv = document.createElement('div');
      metricDiv.className = 'metric';
      metricDiv.innerHTML = `
        <h3>${platform.charAt(0).toUpperCase() + platform.slice(1)}</h3>
        <p>Posts: ${stats.posts}</p>
        <p>Interactions: ${stats.interactions}</p>
        <p>Avg Time: ${stats.avgTime}s</p>
      `;
      this.metrics.appendChild(metricDiv);
    });
  }

  aggregateByPlatform(data) {
    const aggregated = {};
    
    data.forEach(item => {
      if (!aggregated[item.platform]) {
        aggregated[item.platform] = {
          posts: 0,
          interactions: 0,
          totalTime: 0,
          count: 0
        };
      }
      
      aggregated[item.platform].posts++;
      aggregated[item.platform].interactions += item.metrics?.likes || 0;
      aggregated[item.platform].totalTime += item.metrics?.timeOnPage || 0;
      aggregated[item.platform].count++;
    });

    // Calculate averages
    Object.keys(aggregated).forEach(platform => {
      const stats = aggregated[platform];
      stats.avgTime = Math.round(stats.totalTime / stats.count);
    });

    return aggregated;
  }

  drawChart(data) {
    // Simple chart drawing using canvas
    const canvas = this.chart;
    const ctx = canvas.getContext('2d');
    
    // Chart drawing logic
    // This would use a charting library like Chart.js in production
  }
}

new Popup();
```

### Integration with Backend

The browser extension can sync data with the backend API:

```javascript
// api-client.js
class ApiClient {
  constructor() {
    this.baseUrl = 'https://your-backend.com/api';
  }

  async syncAnalyticsData(data) {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to sync analytics:', error);
      // Queue for retry
      this.queueForRetry(data);
    }
  }

  async getAuthToken() {
    // Retrieve or refresh authentication token
    const result = await chrome.storage.local.get(['authToken']);
    return result.authToken;
  }

  queueForRetry(data) {
    // Implement retry logic
    chrome.storage.local.get(['retryQueue'], (result) => {
      const queue = result.retryQueue || [];
      queue.push(data);
      chrome.storage.local.set({ retryQueue: queue });
    });
  }
}
```

### Deployment and Distribution

#### Chrome Web Store

1. **Prepare Extension Package**
   ```bash
   zip -r social-analytics-extension.zip browser-extension/
   ```

2. **Chrome Developer Dashboard**
   - Create a new developer account
   - Upload the extension package
   - Fill out listing information
   - Submit for review

#### Firefox Add-ons

1. **Convert for Firefox**
   - Update manifest.json for Firefox compatibility
   - Use WebExtension APIs

2. **Firefox Developer Portal**
   - Create an account
   - Submit extension for review

### Security Considerations

1. **Data Privacy**
   - Anonymize user data before transmission
   - Implement proper consent mechanisms
   - Comply with GDPR and other privacy regulations

2. **API Security**
   - Use OAuth 2.0 for authentication
   - Implement rate limiting
   - Validate all input data

3. **Extension Security**
   - Use Content Security Policy (CSP)
   - Minimize permissions requested
   - Regular security audits

### Performance Optimization

1. **Efficient Data Collection**
   - Debounce event handlers
   - Use requestAnimationFrame for animations
   - Implement lazy loading

2. **Storage Management**
   - Implement data pruning policies
   - Use IndexedDB for large datasets
   - Compress data before storage

3. **Network Optimization**
   - Batch API requests
   - Implement offline support
   - Use caching strategies

## Conclusion

This analytics extension guide provides a comprehensive approach to enhancing the existing plugin architecture with PostPlanify's advanced analytics capabilities. The browser extension implementation offers real-time data collection and enhanced tracking that can complement the server-side analytics.

By following these patterns and implementation guidelines, you can extend each plugin to provide comprehensive analytics that match PostPlanify's feature set while maintaining the existing architecture and code quality standards.