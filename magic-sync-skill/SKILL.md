---
name: magic-sync
description: MagicSync social media CLI — Create, schedule, and manage social media posts across multiple platforms. Use when asked to create a social media post, schedule content, manage posts, generate social media content, post to Twitter/Facebook/Instagram/Bluesky/LinkedIn, or any social media management task.
argument-hint: "<action: create-post, schedule-post, validate-content, get-platforms, ping-api, test-cli, or 'describe the task'>"
version: 1.1.0
allowed-tools:
  - Bash
  - Read
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh"
          statusMessage: "using MagicSync CLI skill"
triggers:
  - create social media post
  - schedule post
  - post to twitter
  - post to instagram
  - post to facebook
  - post to bluesky
  - post to linkedin
  - social media
  - generate social post
  - schedule social media
  - magicsync
  - magic sync
  - test cli
  - validate content
  - get platforms
  - connected accounts
  - social media platforms
  - cross-post
---

## Overview

The MagicSync CLI skill enables AI agents to create, validate, schedule, and publish social media posts across multiple platforms (Twitter/X, Facebook, Instagram, Bluesky, LinkedIn, TikTok, etc.).

## Setup

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAGICSYNC_API_TOKEN` | Yes | - | API key from MagicSync dashboard |
| `MAGICSYNC_BASE_URL` | No | `http://localhost:3000` | API base URL |

### Get Your API Key

1. Log into MagicSync dashboard
2. Go to Settings > API Keys
3. Create a new API key or use an existing one

## Workflow

### Step 1: Load or Fetch Platform Info

**Check for cached platform info first:**
```bash
cat ~/.magicsync/platforms.json 2>/dev/null || echo "NOT_FOUND"
```

**If not cached or stale (older than 24h), fetch fresh info:**
```bash
MAGICSYNC_API_TOKEN="your-key" MAGICSYNC_BASE_URL="http://localhost:3000" \
  ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh info
```

**Save to persistent location:**
```bash
mkdir -p ~/.magicsync
MAGICSYNC_API_TOKEN="your-key" MAGICSYNC_BASE_URL="http://localhost:3000" \
  ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh info > ~/.magicsync/platforms.json
```

**Cached file structure (`~/.magicsync/platforms.json`):**
```json
{
  "success": true,
  "data": {
    "businessId": "4c919907-695a-4f5c-b19f-626e79d1b1c3",
    "apiKeyName": "cli",
    "platforms": [
      {
        "platform": "facebook",
        "accounts": [
          {
            "accountId": "0b584753-71b0-4932-8339-b582847422af",
            "accountName": "Ismael Garcia Canseco",
            "isActive": true
          }
        ]
      }
    ]
  }
}
```

**Key fields:**
- `platform` — Platform name (e.g., "facebook", "twitter") — used for `platformContent` overrides
- `accountId` — UUID used in the `platforms` array when creating posts
- `accountName` — Human-readable name to show the user

### Step 2: Present Connected Accounts to User

Read `~/.magicsync/platforms.json` and display the connected accounts with their platform and account names.

**Example presentation:**
```
Connected Accounts:
1. Facebook - "Ismael Garcia Canseco"
2. Twitter/X - "leamsigc"
3. Instagram - "leamsigc"
4. LinkedIn - "Ismael Garcia Canseco"
5. LinkedIn Page - "Giessen Devs"
6. Bluesky - "leamsigc.bsky.social"

Which account(s) would you like to post to? (e.g., "all", "1 and 3", "facebook and bluesky")
```

**Extracting account IDs for the API call:**
```bash
# Get all accounts as JSON array
cat ~/.magicsync/platforms.json | jq '.data.platforms[]'

# Get Facebook account ID
FACEBOOK_ID=$(cat ~/.magicsync/platforms.json | jq -r '.data.platforms[] | select(.platform=="facebook") | .accounts[0].accountId')

# Get all account IDs (for "all" option)
ALL_IDS=$(cat ~/.magicsync/platforms.json | jq -r '.data.platforms[] | .accounts[0].accountId')
```

### Step 3: Build Platform Array from User Selection

- If user says "all" → extract all account IDs from saved data
- If user specifies "facebook" → find that platform's account ID
- Build the `platforms` array with account IDs, not platform names

### Step 4: Validate Content (Optional but Recommended)

```bash
MAGICSYNC_API_TOKEN="your-key" MAGICSYNC_BASE_URL="http://localhost:3000" \
  ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh validate '<json_payload>'
```

### Step 5: Create/Schedule Post

**Important:** The `platforms` array must contain **account IDs** (UUIDs), not platform names like "twitter" or "facebook".

```bash
# Wrong - uses account IDs
echo '{"content":"Your post","platforms":["fb7e5f3b-5117-438f-99db-c323ff01b156"],"scheduledAt":"2026-06-01T14:00:00Z"}'

# Correct - uses platform names (will fail)
echo '{"content":"Your post","platforms":["facebook"],"scheduledAt":"2026-06-01T14:00:00Z"}'
```

```bash
MAGICSYNC_API_TOKEN="your-key" MAGICSYNC_BASE_URL="http://localhost:3000" \
  ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh post '<json_payload_with_account_ids>'
```

---

## Complete Workflow Examples

### First Time Setup (Fetch and Cache Platforms)

```bash
# 1. Fetch platform info and save
mkdir -p ~/.magicsync
MAGICSYNC_API_TOKEN="your-key" MAGICSYNC_BASE_URL="http://localhost:3000" \
  ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh info > ~/.magicsync/platforms.json

# 2. Read the cached info
cat ~/.magicsync/platforms.json | jq '.data.platforms[].platform'

# Output: ["twitter"], ["facebook"], etc.
```

### Schedule Post to Specific Platform

```bash
# 1. Check cached platforms
PLATFORMS=$(cat ~/.magicsync/platforms.json)

# 2. User chooses "facebook" → extract account ID for facebook
FACEBOOK_ACCOUNT=$(echo "$PLATFORMS" | jq -r '.data.platforms[] | select(.platform=="facebook") | .accounts[0].accountId')
echo "Facebook account ID: $FACEBOOK_ACCOUNT"

# 3. Create post for facebook using account ID
echo "{
  \"content\": \"Your post content here\",
  \"platforms\": [\"$FACEBOOK_ACCOUNT\"],
  \"scheduledAt\": \"2026-06-01T14:00:00Z\"
}" | MAGICSYNC_API_TOKEN="your-key" MAGICSYNC_BASE_URL="http://localhost:3000" \
  ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh post
```

### Schedule Post to All Platforms

```bash
# Extract all account IDs from cached info
PLATFORMS=$(cat ~/.magicsync/platforms.json)

# Get all account IDs as JSON array
ALL_ACCOUNT_IDS=$(echo "$PLATFORMS" | jq '[.data.platforms[].accounts[].accountId]')
echo "All account IDs: $ALL_ACCOUNT_IDS"

# Create post for all accounts
echo "{
  \"content\": \"Your post content here\",
  \"platforms\": $ALL_ACCOUNT_IDS,
  \"scheduledAt\": \"2026-06-01T14:00:00Z\"
}" | MAGICSYNC_API_TOKEN="your-key" MAGICSYNC_BASE_URL="http://localhost:3000" \
  ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh post
```

---

## API Commands

### ping
Test API connectivity.
```bash
MAGICSYNC_API_TOKEN="your-key" MAGICSYNC_BASE_URL="http://localhost:3000" \
  ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh ping
```

### info
Get connected platforms and save to file.
```bash
# To stdout (for manual inspection)
MAGICSYNC_API_TOKEN="your-key" MAGICSYNC_BASE_URL="http://localhost:3000" \
  ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh info

# Save to file
MAGICSYNC_API_TOKEN="your-key" MAGICSYNC_BASE_URL="http://localhost:3000" \
  ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh info > ~/.magicsync/platforms.json
```

### validate
Validate content before posting (use account IDs, not platform names).
```bash
# Get Facebook account ID first
FACEBOOK_ACCOUNT=$(cat ~/.magicsync/platforms.json | jq -r '.data.platforms[] | select(.platform=="facebook") | .accounts[0].accountId')

echo "{\"content\":\"Your post\",\"platforms\":[\"$FACEBOOK_ACCOUNT\"]}" | \
  MAGICSYNC_API_TOKEN="your-key" MAGICSYNC_BASE_URL="http://localhost:3000" \
  ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh validate
```

### post
Create or schedule a post (use account IDs, not platform names).
```bash
# Get account ID
FACEBOOK_ACCOUNT=$(cat ~/.magicsync/platforms.json | jq -r '.data.platforms[] | select(.platform=="facebook") | .accounts[0].accountId')

echo "{\"content\":\"Your post\",\"platforms\":[\"$FACEBOOK_ACCOUNT\"],\"scheduledAt\":\"2026-06-01T14:00:00Z\"}" | \
  MAGICSYNC_API_TOKEN="your-key" MAGICSYNC_BASE_URL="http://localhost:3000" \
  ${CLAUDE_SKILL_DIR}/magic-sync-skill/bin/test.sh post
```

---

## Post Payload Structure

**Important:** The `platforms` array must contain **account IDs** (UUIDs), not platform names.

```json
{
  "content": "Your post content",
  "platforms": ["0b584753-71b0-4932-8339-b582847422af"],
  "media": {
    "image": ["https://example.com/image.jpg"]
  },
  "scheduledAt": "2026-06-15T09:00:00Z",
  "commentPrompts": ["What do you think?"],
  "platformContent": {
    "facebook": {
      "content": "Facebook-specific version"
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `content` | Yes | Post content |
| `platforms` | Yes | Array of account UUIDs (from `~/.magicsync/platforms.json`) |
| `media.image` | No | Array of image URLs |
| `media.video` | No | Video URL |
| `scheduledAt` | No | ISO 8601 UTC date. Omit for immediate publish |
| `commentPrompts` | No | AI prompts for generating engagement comments |
| `platformContent` | No | Per-platform content overrides (keys are platform names like "facebook") |

---

## Platform Names Reference

These are **platform names** used for `platformContent` overrides, NOT account IDs.

| Platform | Platform Name | Max Length |
|----------|---------------|------------|
| Twitter/X | `twitter` | 280 |
| Facebook | `facebook` | 63,206 |
| Instagram | `instagram` | 2,200 |
| LinkedIn | `linkedin` | 3,000 |
| Bluesky | `bluesky` | 300 |
| TikTok | `tiktok` | 2,200 |

**Account IDs** (UUIDs like `"0b584753-71b0-4932-8339-b582847422af"`) go in the `platforms` array when creating posts. **Platform names** (like `"facebook"`) go in `platformContent` overrides.

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `401 Invalid or missing API key` | Invalid or expired API token | Get a new API key from dashboard |
| `400 Platforms not connected` | User hasn't connected that platform | Have user connect via dashboard first |
| `400 Validation failed` | Content exceeds platform limits | Shorten content or reduce media |
| `NOT_FOUND` when reading platforms.json | No cached platform info | Run `info` command to fetch and save |

---

## Best Practices

1. **Always load cached platforms first** — Check `~/.magicsync/platforms.json` before asking user where to post
2. **Present accounts with names** — Show account names (e.g., "Ismael Garcia Canseco - Facebook") not just platform names
3. **Use account IDs, not platform names** — The `platforms` array must contain UUIDs like `"0b584753-71b0-4932-8339-b582847422af"`, not `"facebook"`
4. **Ask user explicitly** — "Which account(s): all or specific?" rather than assuming
5. **Validate before posting** — Catch errors early with the validate command
6. **Schedule strategic timing** — Use `scheduledAt` for optimal posting times (e.g., 8 AM CST for Mexican audiences)