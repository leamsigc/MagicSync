# @local-monorepo/auth

Auth Layer - User authentication and authorization using Better Auth.

## Overview

This layer handles all user authentication and authorization functionality using the Better Auth package. It provides comprehensive user management and role-based access control.

### Features

- **Better Auth Integration**: Uses Better Auth for secure authentication
- **User Registration**: Complete user registration flow
- **Login/Logout**: Secure login and logout functionality
- **Password Management**: Password change and reset capabilities
- **Email Verification**: Email verification system
- **Admin Panel**: Administrative user management
- **Role Management**: User role and permission management
- **API Keys**: Business-owned API keys for programmatic access
- **Organization Support**: Teams and organization management

### User Capabilities

- User can register for an account
- User can login to their account
- User can logout from their account
- User can change their password
- User can change their email address
- User can verify their email address
- Admin users can manage other users
- Admin users can ban/unban users

### API Endpoints

- User registration API
- Authentication APIs (login/logout)
- Password management APIs
- Email verification APIs
- User management APIs (admin only)
- Role and permission APIs
- API Key management APIs

## API Keys

Business owners can create API keys to allow programmatic access to their business data. API keys are owned by organizations which are automatically created/linked to businesses.

### Creating an API Key

API keys can be created via the business settings UI. When created, the API key includes:
- Business ID
- Business name
- Connected social media platforms

### API Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/api-keys/create` | Create a new API key |
| GET | `/api/v1/api-keys/list` | List all API keys for a business |
| DELETE | `/api/v1/api-keys/delete` | Revoke an API key |

### Using API Keys

Include your API key in the `x-api-key` header:

```bash
curl -X POST https://your-app.com/api/v1/cli/post \
  -H "x-api-key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello world!",
    "platforms": ["instagram", "twitter"],
    "media": {
      "image": ["https://example.com/image.jpg"]
    },
    "scheduledAt": "2026-03-28T10:00:00Z",
    "comments": ["Check this out!"]
  }'
```

### CLI Post Endpoint (Scheduler)

The scheduler package provides a CLI-compatible endpoint for creating posts programmatically:

**Endpoint:** `POST /api/v1/cli/post`

**Headers:**
- `x-api-key` - Your API key

**Request Body:**
```json
{
  "content": "Text content for the post",
  "platforms": ["instagram", "twitter", "facebook"],
  "media": {
    "image": ["https://example.com/image.jpg"],
    "video": "https://example.com/video.mp4"
  },
  "scheduledAt": "2026-03-28T10:00:00Z",
  "comments": ["Comment 1", "Comment 2"]
}
```

**Response:**
```json
{
  "success": true,
  "postId": "post_xxx",
  "status": "scheduled",
  "scheduledAt": "2026-03-28T10:00:00Z",
  "content": "Formatted content",
  "platforms": ["instagram", "twitter"],
  "validationResults": {
    "instagram": { "isValid": true },
    "twitter": { "isValid": true }
  },
  "platformStatuses": [
    { "platform": "instagram", "status": "pending" }
  ]
}
```

**Features:**
- Validates content for each target platform
- Automatically formats content using AI if validation fails
- Downloads and creates assets from media URLs
- Schedules posts for future publishing or publishes immediately
- Adds comments to posts on supported platforms

## Service Layer Rules

### Rule 1: Endpoint Orchestration — Never Look Up What the Caller Already Has

The endpoint owns the orchestration. Services do one thing. The caller (endpoint) should never pass data to a service that the service then looks up again internally.

**Anti-pattern (don't do this):**
```ts
// Endpoint
const business = await businessProfileService.findById(businessId, userId)
// ...
const gmbStatus = await businessProfileService.isConnectedToGMB(businessId, userId)
//                     ↑ internally calls findById AGAIN — redundant DB query
```

**Correct pattern:**
```ts
// Endpoint fetches once, passes to service
const business = await businessProfileService.findById(businessId, userId)
// ...
const gmbStatus = await businessProfileService.isConnectedToGMB(businessId, userId, business)
//                     ↑ optional business param skips the redundant findById
```

**Implementation pattern:**
Services that need data the caller already has should accept an optional parameter:

```ts
// Anti-pattern: service always calls findById internally
async isConnectedToGMB(businessId: string, userId: string): Promise<ServiceResponse<boolean>> {
  const profileResult = await this.findById(businessId, userId) // ← redundant
  // ...
}

// Correct: optional param skips the lookup
async isConnectedToGMB(
  businessId: string,
  userId: string,
  business?: BusinessProfile  // ← optional, caller provides if already fetched
): Promise<ServiceResponse<boolean>> {
  const profile = business ?? (await this.findById(businessId, userId))?.data
  // ...
}
```

**When `findById` in `update`/`delete` is fine:** Those methods need to verify existence AND ownership — that's their actual work, not a redundant lookup.

**Rationale:** Each internal `findById` call is a DB round-trip. In a request that already fetched the data at the top, a service doing it again multiplies latency and DB load unnecessarily.

### Rule 2: Use `ServiceResponse<T>`, Never Throw

All service methods return `ServiceResponse<T>`. Never `throw` from a service — the endpoint decides how to translate errors into HTTP responses.

### Rule 3: No Database Queries in Route Handlers

Route handlers (endpoints) must not write raw SQL or use `db` directly. All DB access goes through a service in `packages/db/server/services/`.

### Rule 4: Idempotent Upsert Pattern for External Resources

When calling external services (like Better Auth's `createOrganization`), race conditions cause `ORGANIZATION_ALREADY_EXISTS`. Always catch the error and fetch instead:

```ts
try {
  org = await authApi.createOrganization({ body: { name, slug, metadata } })
} catch (err) {
  if (isOrgAlreadyExistsError(err)) {
    org = await authApi.getFullOrganization({ query: { organizationId: slug } })
  } else {
    throw err
  }
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
