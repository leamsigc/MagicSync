# Platform Keys Setup

To use the social media scheduling features, you need to obtain API keys for each supported platform.

## Supported Platforms

### Bluesky
- **Username**: Your Bluesky handle.
- **App Password**: Generate an App Password in Settings > App Passwords.

### Dev.to
- **API Key**: Generate in Settings > Extensions > API Keys.

### Discord
- **Bot Token**: Create a bot in the [Discord Developer Portal](https://discord.com/developers/applications).

### Dribbble
- **Client ID & Secret**: Register an application in Dribbble API settings.

### Facebook
- **App ID & Secret**: Create an app in [Meta for Developers](https://developers.facebook.com/).
- **Page Access Token**: Required for posting to pages.

### Instagram
- **Graph API**: Requires a Facebook App with Instagram Graph API permission.

### LinkedIn
- **Client ID & Secret**: Create an app in [LinkedIn Developers](https://www.linkedin.com/developers/).

### Reddit
- **Client ID & Secret**: Create an app in Reddit preferences > apps.

### Threads
- **API Key**: (Currently limited/beta, check Meta Developers).

### TikTok
- **Client Key & Secret**: Register in TikTok for Developers.

### WordPress
- **Application Password**: Generate in User Profile > Application Passwords.

### X (Twitter)
- **API Key & Secret**: Create a project in [X Developer Portal](https://developer.twitter.com/).
- **Access Token & Secret**: Generate for your account.

### Google — Overview (single OAuth client, 4 providers)

All Google-family auth shares one OAuth 2.0 client (`NUXT_GOOGLE_CLIENT_ID` /
`NUXT_GOOGLE_CLIENT_SECRET`). `NUXT_YOUTUBE_CLIENT_ID` is unused for OAuth.
Each capability is a separate Better Auth provider in
`packages/auth/lib/auth.ts` and must be connected separately (incremental auth):

| Provider ID | Scopes | Purpose |
|---|---|---|
| `google` | `openid email profile` | Login / identity only |
| `youtube` | `openid email profile` + `https://www.googleapis.com/auth/youtube.force-ssl` | List channels, upload videos, read status |
| `google-drive` | `openid email profile` + `https://www.googleapis.com/auth/drive.readonly` | Browse + import images/videos into posts |
| `googlemybusiness` | `openid email profile` + `https://www.googleapis.com/auth/business.manage` | List locations, publish Business posts |

Never bundle these scopes into one request. Google rejects cross-family bundles
(YouTube + Drive + Business) with `Error 400: scopes that cannot be requested
together`, and rejects parent+subset bundles (`youtube` together with
`youtube.readonly` / `youtube.upload`). `plus.business.manage` is dead
(Google+ shutdown) and `docs` / full `drive` are not used — do not request them.

Code references: `packages/auth/lib/auth.ts:120-144,327-391`,
`packages/connect/app/pages/app/integrations/composables/useConnectionManager.ts:91`,
`packages/assets/app/composables/useGoogleDrive.ts:44`.

### Google Cloud setup (developer checklist)

1. Enable APIs on the same project: YouTube Data API v3, Drive API,
   My Business Account Management API, Business Information API,
   Business Profile Performance API.
2. OAuth consent screen > Data Access: list exactly these (string match to code):
   `openid`, `email`, `profile`,
   `https://www.googleapis.com/auth/youtube.force-ssl`,
   `https://www.googleapis.com/auth/drive.readonly`,
   `https://www.googleapis.com/auth/business.manage`.
   Remove `youtube`, `youtube.readonly`, `youtube.upload`, `drive`, `docs`,
   `drive.file`, `plus.business.manage` if present.
3. Credentials > OAuth client (`NUXT_GOOGLE_CLIENT_ID`) > Authorized redirect URIs
   (exact match, dev + prod — pattern `NUXT_BETTER_AUTH_URL` + `/api/auth/callback/<provider>`):
   - `http://localhost:3000/api/auth/callback/google` (login)
   - `http://localhost:3000/api/auth/callback/youtube`
   - `http://localhost:3000/api/auth/callback/google-drive`
   - `http://localhost:3000/api/auth/callback/googlemybusiness`
   - plus the `https://<your-domain>/...` equivalents for production.
4. Env: `NUXT_GOOGLE_CLIENT_ID`, `NUXT_GOOGLE_CLIENT_SECRET`,
   `NUXT_BETTER_AUTH_URL`, `NUXT_APP_URL`. Keep Publishing Status
   `In Production`; test new scopes on staging, never push unverified scopes
   to prod traffic.
5. Privacy Policy + Terms must be public (footer links) and include the
   Limited Use statement: “The use of raw or derived user data received from
   Workspace APIs will adhere to the Google User Data Policy, including the
   Limited Use requirements.” Disclose AI providers/tiers (OpenAI, Gemini) and
   that Workspace data is never used to train generalized models.

### YouTube

- **Scopes requested** (single `youtube.force-ssl` — it supersedes
  `youtube`/`youtube.upload`/`youtube.readonly`, which Google rejects when
  combined): `openid email profile` +
  `https://www.googleapis.com/auth/youtube.force-ssl`, with
  `access_type=offline`, `prompt=consent`, `include_granted_scopes=false`
  (false is required — true would merge stale grants from the old scope bundle
  back into new requests and Google rejects the mix with 400).
- **What it does:** channel picker (`youtube.channels.list mine=true`),
  video upload (`videos.insert` + `thumbnails.set`), status/analytics
  (`videos.list`, `playlistItems.list`). See
  `packages/scheduler/server/services/plugins/youtube.plugin.ts:105,224,245`.
- **Connect flow:** `/app/integrations` > YouTube card > `linkSocial({ provider: 'youtube' })` >
  pick channel > stored via `socialMediaAccountService`. Compose at `/app/posts`
  with video asset + title/description/privacy/madeForKids (`YouTubeSettings.vue`).
- **Roles / prerequisites**: the Google account must own (or manage, for
  Brand Accounts) at least one YouTube channel — accounts without a channel
  complete OAuth but create no connection. For production, the OAuth consent
  screen must be published; `youtube.force-ssl` is a sensitive scope, so
  Google verification is required before external users can connect.

### Google (login, Drive, Business)

Same redirect-URI rule as YouTube — all Google-family providers share the
`NUXT_GOOGLE_CLIENT_ID` OAuth client, so register one URI per provider ID
on that single client (see list above).

- **Login (`google`):** identity only. `includeGrantedScopes: false` so prior
  YouTube/Drive grants are never merged into login (avoids repeat 400s).
- **Drive (`google-drive`):** `drive.readonly` only. Powers the media picker:
  `GET /api/v1/assets/google-drive/list` (`drive/v3/files?q=...`) and
  `POST /api/v1/assets/google-drive/download` (`files/{id}?alt=media` + `/export`).
  See `packages/assets/server/utils/GoogleDriveUtils.ts`,
  `packages/assets/app/composables/useGoogleDrive.ts`,
  `packages/assets/app/components/GoogleDriveGallery.vue`.
  Connect at `/app/media` > Drive tab > `linkSocial({ provider: 'google-drive' })`.
  Read-only: the app never creates, edits, deletes, or shares Drive files.
  `drive.readonly` is a restricted scope — verification + security assessment
  apply; `drive.file` + Picker is the non-sensitive alternative but only
  exposes user-picked files.
- **Business (`googlemybusiness`):** `business.manage` only. Lists
  `accounts` + `locations` (`google.plugin.ts:getGMBLocations`) and publishes
  EVENT/OFFER/STANDARD posts with summary/CTA/media
  (`googlemybusiness.plugin.ts:createPost`). Connect at `/app/integrations` >
  Google Business card; location IDs look like `accounts/.../locations/...`.

### Google verification — demo video shot list

Record on staging with a fresh test user (no 2FA/phone/CAPTCHA blockers).
Show URL bar, 1080p, linger on each consent screen with “Show all services”
expanded so every scope string is readable. Keep under ~10 min.

1. `0:00-0:30` Intro: homepage + footer Privacy/Terms links, login as reviewer test user.
2. `0:30-1:30` Consent (YouTube): Integrations > Connect YouTube > account chooser >
   consent expanded showing `youtube.force-ssl`. Narrate why it is needed.
3. `1:30-3:00` YouTube read: channel picker with owned channel (proves `channels.list`),
   connected list at `/app/integrations/active`.
4. `3:00-5:30` YouTube write + Source Account Impact (mandatory for write scopes):
   new post with video + title/desc/thumbnail/Private > Publish Now > success +
   `youtube.com/watch?v=...` > open YouTube Studio in a new tab showing the same
   video Private with matching title.
5. `5:30-7:00` Drive (`drive.readonly`): Media > Connect Drive > consent expanded >
   list/search images/videos > select 2 > Import > show in Media Gallery + attached
   to a post draft. State on camera: read-only, no Drive writes.
6. `7:00-8:30` Business (`business.manage`): Integrations > Google Business > consent
   expanded > location picker (`accounts/.../locations/...`) > create STANDARD post >
   Publish > open Google Maps / Business Profile showing the live post.
7. `8:30-9:00` Scope match: Cloud Console Data Access screen side-by-side with code
   (`auth.ts` scopes) and consent screens — all strings identical.
8. Upload as unlisted YouTube link. Reply to the verification thread with the link +
   timestamps per scope, test credentials + step-by-step navigation, removed-scopes
   note (deleted `youtube`, `youtube.readonly`, `youtube.upload`, `drive` full,
   `docs` for least privilege), integration-platform note (separate incremental
   auth — bundles 400), and AI disclosure (OpenAI/Gemini providers + tiers +
   Limited Use URL).
