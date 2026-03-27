# @local-monorepo/scheduler

Scheduler Layer - API and UI for scheduling social media posts.

## Overview

This layer provides comprehensive scheduling functionality for social media posts including creation, management, and automated posting.

### Features

- **Post Scheduling**: Schedule individual or multiple posts
- **Calendar View**: Visual calendar interface for schedule management
- **List View**: Detailed list view of all scheduled posts
- **CRUD Operations**: Create, read, update, and delete schedules
- **Automated Posting**: API triggers for scheduled post publishing
- **Export Functionality**: Export schedules to CSV format
- **CLI/API Post Creation**: Programmatic post creation via API keys

### Capabilities

- User can view the post scheduler interface
- API automatically triggers posts based on schedule
- User can create new schedules
- User can edit existing schedules
- User can delete schedules
- User can view schedules in calendar format
- User can view schedules in list format
- User can export schedules to CSV files
- Third-party integrations can create posts via API keys

## CLI Post Endpoint

External systems can create posts programmatically using API key authentication.

### Authentication

Include your API key in the `x-api-key` header:

```bash
curl -X POST https://your-app.com/api/v1/cli/post \
  -H "x-api-key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello world!",
    "platforms": ["instagram", "twitter"]
  }'
```

### Endpoint

**URL:** `POST /api/v1/cli/post`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | Yes | Text content for the post |
| platforms | string[] | Yes | Target platforms (instagram, twitter, facebook, etc.) |
| media | object | No | Media attachments |
| media.image | string[] | No | Array of image URLs |
| media.video | string | No | Video URL |
| scheduledAt | string | No | ISO date string for scheduling (omit for immediate publish) |
| comments | string[] | No | Comments to add to the post |

### Example Request

```json
{
  "content": "Check out our new product!",
  "platforms": ["instagram", "twitter", "facebook"],
  "media": {
    "image": [
      "https://example.com/images/product1.jpg",
      "https://example.com/images/product2.jpg"
    ],
    "video": "https://example.com/videos/demo.mp4"
  },
  "scheduledAt": "2026-03-28T14:00:00Z",
  "comments": [
    "Shop now!",
    "Link in bio!"
  ]
}
```

### Response

```json
{
  "success": true,
  "postId": "post_abc123",
  "status": "scheduled",
  "scheduledAt": "2026-03-28T14:00:00Z",
  "content": "Check out our new product!",
  "platforms": ["instagram", "twitter", "facebook"],
  "validationResults": {
    "instagram": { "isValid": true },
    "twitter": { "isValid": true },
    "facebook": { "isValid": true }
  },
  "platformStatuses": [
    { "platform": "instagram", "status": "pending" },
    { "platform": "twitter", "status": "pending" },
    { "platform": "facebook", "status": "pending" }
  ]
}
```

### Features

1. **Automatic Asset Creation**: Downloads images/videos from URLs and creates assets in your media library
2. **Content Validation**: Validates content for each platform's requirements
3. **AI Formatting**: If content fails validation, automatically uses AI to reformat it
4. **Immediate or Scheduled**: Publish immediately or schedule for a future date
5. **Platform Comments**: Adds comments to posts on supported platforms

### Error Handling

If validation fails after AI formatting attempt:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Content validation failed for instagram: Content exceeds maximum length. Please adjust your content to meet instagram's requirements."
}
```

If no connected accounts exist for the requested platforms:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "No connected accounts found for platforms: instagram, twitter. Please connect these platforms in your business settings first."
}
```

## Setup

Make sure to install the dependencies:

```bash
pnpm install
```

## Development

Start the development server:

```bash
pnpm dev
```

## Scripts

- `pnpm dev` - Start development server with playground
- `pnpm build` - Build the layer
- `pnpm lint` - Run ESLint
