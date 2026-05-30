# MagicSync CLI API Documentation

A command-line interface for AI agents to interact with MagicSync social media scheduling platform.

## Overview

The CLI API enables AI agents to:
1. Check API connectivity and authentication
2. Retrieve connected platforms and their configuration rules
3. Validate content against platform-specific constraints
4. Create, schedule, and publish social media posts

## Base URL

```
http://localhost:3000/api/v1/cli
```

## Authentication

All endpoints require a valid API key passed via the `X-Api-Key` header.

```bash
curl -H "X-Api-Key: your-api-key-here" http://localhost:3000/api/v1/cli/ping
```

**Note:** Get your API key from the MagicSync dashboard under Settings > API Keys.

## Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ping` | Test API connectivity and authentication |
| GET | `/info` | Get connected platforms and their rules |
| POST | `/validate` | Validate content against platform rules |
| POST | `/post` | Create and optionally publish/schedule a post |

---

## Endpoints Detail

### GET /ping

Test API connectivity and authentication.

**Request:**
```bash
curl -X GET \
  -H "X-Api-Key: your-api-key" \
  http://localhost:3000/api/v1/cli/ping
```

**Response:**
```json
{
  "apiKey": {
    "valid": true,
    "businessId": "biz_xxx",
    "name": "My API Key"
  },
  "path": "/api/v1/cli/ping",
  "middlewareOrder": "if you see this, auth middleware ran before api-key middleware"
}
```

---

### GET /info

Get connected platforms, account details, and platform rules.

**Request:**
```bash
curl -X GET \
  -H "X-Api-Key: your-api-key" \
  http://localhost:3000/api/v1/cli/info
```

**Response:**
```json
{
  "success": true,
  "data": {
    "businessId": "biz_xxx",
    "apiKeyName": "My API Key",
    "platforms": [
      {
        "platform": "twitter",
        "accounts": [
          {
            "accountId": "acc_xxx",
            "accountName": "@myhandle",
            "isActive": true,
            "tokenExpiresAt": "2026-12-31T23:59:59.000Z",
            "lastSyncAt": "2026-05-29T10:30:00.000Z"
          }
        ],
        "config": {
          "maxPostLength": 280,
          "maxImages": 4,
          "supportsComments": true,
          "supportsCarousel": false,
          "supportsVideo": true,
          "maxVideoLengthSeconds": 140,
          "supportsLinkPreviews": true,
          "supportsStories": false,
          "supportsShorts": false,
          "supportedFormats": ["post"],
          "mediaConstraints": {
            "imageFileTypes": ["JPEG", "PNG", "GIF", "WebP"],
            "videoFileTypes": ["MP4", "MOV"],
            "maxImageSizeMB": 5,
            "maxVideoSizeMB": 512,
            "maxVideoLengthSeconds": 140,
            "aspectRatios": {
              "min": 1.0,
              "max": 1.78,
              "recommended": ["1:1", "16:9"]
            },
            "supportsDocuments": false
          }
        }
      }
    ],
    "allPlatformRules": { ... }
  }
}
```

---

### POST /validate

Validate content against platform rules before posting.

**Request:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-api-key" \
  -d '{
    "content": "Your post content here",
    "platforms": ["twitter", "bluesky"],
    "media": {
      "image": ["https://example.com/image.jpg"]
    }
  }' \
  http://localhost:3000/api/v1/cli/validate
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes* | Default content for all platforms |
| `platforms` | string[] | Yes* | Platform IDs to validate against |
| `media` | object | No | Media attachments |
| `media.image` | string[] | No | URLs of images |
| `media.video` | string | No | URL of video |
| `platformContent` | object | No | Per-platform content overrides |

*Either `content` or `platformContent` is required

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "validations": {
      "twitter": {
        "isValid": true,
        "warnings": ["Content is 85% of 280 char limit"],
        "errors": [],
        "config": { ... }
      }
    },
    "summary": {
      "total": 1,
      "valid": 1,
      "invalid": 0
    }
  }
}
```

---

### POST /post

Create and optionally publish or schedule a post.

**Request:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-api-key" \
  -d '{
    "content": "Your post content here",
    "platforms": ["twitter", "bluesky"],
    "media": {
      "image": ["https://example.com/image.jpg"]
    },
    "scheduledAt": "2026-06-01T10:00:00Z",
    "commentPrompts": ["What do you think?", "Agree?"]
  }' \
  http://localhost:3000/api/v1/cli/post
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Default content for all platforms |
| `platforms` | string[] | Yes | Platform IDs to post to |
| `media` | object | No | Media attachments |
| `media.image` | string[] | No | URLs of images (downloaded automatically) |
| `media.video` | string | No | URL of video |
| `scheduledAt` | string | No | ISO 8601 date. Omit or set to past to post immediately |
| `commentPrompts` | string[] | No | Prompts for AI to generate engagement comments |
| `platformContent` | object | No | Per-platform content overrides |

**Per-Platform Override Example:**
```json
{
  "content": "Same message everywhere",
  "platforms": ["twitter", "instagram"],
  "platformContent": {
    "instagram": {
      "content": "Instagram-specific caption with hashtags"
    },
    "twitter": {
      "content": "Twitter version with shorter text"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "postId": "post_xxx",
  "status": "scheduled",
  "scheduledAt": "2026-06-01T10:00:00.000Z",
  "contentUsed": {
    "twitter": { "content": "Your post content", "image": [...] },
    "instagram": { "content": "Instagram version", "image": [...] }
  },
  "validationResults": {
    "twitter": { "isValid": true, "errors": [], "warnings": [] }
  },
  "platformStatuses": [
    {
      "platform": "twitter",
      "accountId": "acc_xxx",
      "status": "pending",
      "errorMessage": null
    }
  ]
}
```

---

## Platform IDs

| Platform | ID | Max Length | Max Images | Supports Video |
|----------|-----|------------|------------|---------------|
| Twitter/X | `twitter` or `x` | 280 | 4 | Yes (140s) |
| Facebook | `facebook` | 63,206 | 10 | Yes |
| Instagram | `instagram` | 2,200 | 10 | Yes |
| LinkedIn | `linkedin` | 3,000 | 20 | Yes |
| LinkedIn Page | `linkedin-page` | 3,000 | 20 | Yes |
| Bluesky | `bluesky` | 300 | 4 | Yes (60s) |
| TikTok | `tiktok` | 2,200 | 35 | Yes |
| YouTube | `youtube` | 5,000 | 0 | Yes |
| Pinterest | `pinterest` | 500 | 1 | Yes |
| Reddit | `reddit` | 40,000 | 1 | Yes |
| Discord | `discord` | 2,000 | 10 | Yes |
| Mastodon | `mastodon` | 500 | 4 | Yes |
| Threads | `threads` | 500 | 10 | Yes |
| Google Business | `google` | 1,500 | 1 | No |
| Dev.to | `devto` | 25,000 | 1 | No |
| WordPress | `wordpress` | 100,000 | 1 | Yes |
| Dribbble | `dribbble` | 500 | 1 | Yes |

---

## AI Agent Workflow

### Typical Workflow for Creating a Social Media Post

```bash
# 1. Get connected platforms and their rules
INFO=$(curl -s -H "X-Api-Key: $MAGICSYNC_API_TOKEN" http://localhost:3000/api/v1/cli/info)
echo "$INFO" | jq '.data.platforms'

# 2. Generate post content using AI (external)

# 3. Validate the content before posting
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $MAGICSYNC_API_TOKEN" \
  -d '{
    "content": "AI-generated post content",
    "platforms": ["twitter", "bluesky"],
    "media": { "image": ["https://example.com/generated-image.jpg"] }
  }' \
  http://localhost:3000/api/v1/cli/validate

# 4. If validation passes, create the post
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $MAGICSYNC_API_TOKEN" \
  -d '{
    "content": "AI-generated post content",
    "platforms": ["twitter", "bluesky"],
    "media": { "image": ["https://example.com/generated-image.jpg"] },
    "commentPrompts": ["What do you think about this?"]
  }' \
  http://localhost:3000/api/v1/cli/post
```

### Schedule a Post for Later

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $MAGICSYNC_API_TOKEN" \
  -d '{
    "content": "Scheduled post content",
    "platforms": ["twitter"],
    "scheduledAt": "2026-06-15T09:00:00Z"
  }' \
  http://localhost:3000/api/v1/cli/post
```

### Immediate Publish (no scheduledAt)

```bash
# Omit scheduledAt or set to past to publish immediately
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $MAGICSYNC_API_TOKEN" \
  -d '{
    "content": "Publishing immediately",
    "platforms": ["twitter"]
  }' \
  http://localhost:3000/api/v1/cli/post
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "statusMessage": "Invalid or missing API key"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "statusMessage": "content and platforms are required"
}
```

### 400 Validation Failed
```json
{
  "statusCode": 400,
  "statusMessage": "Validation failed for twitter: Content exceeds 280 character limit (currently 350)"
}
```

### 400 Platform Not Connected
```json
{
  "statusCode": 400,
  "statusMessage": "Platforms not connected: tiktok. Connect them in your MagicSync dashboard first."
}
```

---

## Testing with the CLI Test Suite

```bash
cd packages/scheduler/test

# Make the script executable
chmod +x test.sh

# Run all tests
MAGICSYNC_API_TOKEN=your-key ./test.sh all

# Run specific test
MAGICSYNC_API_TOKEN=your-key ./test.sh info

# Test with custom base URL
MAGICSYNC_BASE_URL=https://api.example.com MAGICSYNC_API_TOKEN=your-key ./test.sh ping
```

---

## Complete AI Agent Example

```bash
#!/bin/bash
# Example AI agent workflow for creating a social media campaign

MAGICSYNC_API_TOKEN="your-api-key"
BASE_URL="http://localhost:3000/api/v1/cli"

# Step 1: Get user preferences and connected platforms
echo "Fetching platform information..."
PLATFORMS=$(curl -s -H "X-Api-Key: $MAGICSYNC_API_TOKEN" "$BASE_URL/info")
echo "$PLATFORMS" | jq '.'

# Step 2: AI generates content based on user preferences
# (This would be done by your AI service)
AI_CONTENT="Excited to announce our new product launch! 🚀"
AI_IMAGE="https://example.com/product-launch.jpg"

# Step 3: Validate content for connected platforms
echo "Validating content..."
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $MAGICSYNC_API_TOKEN" \
  -d "{
    \"content\": \"$AI_CONTENT\",
    \"platforms\": [\"twitter\", \"bluesky\"],
    \"media\": { \"image\": [\"$AI_IMAGE\"] }
  }" \
  "$BASE_URL/validate"

# Step 4: Create the post
echo "Creating post..."
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $MAGICSYNC_API_TOKEN" \
  -d "{
    \"content\": \"$AI_CONTENT\",
    \"platforms\": [\"twitter\", \"bluesky\"],
    \"media\": { \"image\": [\"$AI_IMAGE\"] },
    \"commentPrompts\": [
      \"What do you think about this launch?\",
      \"Are you excited too?\"
    ]
  }" \
  "$BASE_URL/post"
```