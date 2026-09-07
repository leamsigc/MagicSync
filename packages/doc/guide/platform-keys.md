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

### Google My Business
- **Client ID & Secret**: Enable Google My Business API in Google Cloud Console.

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

### YouTube
- **Client ID & Secret**: Enable YouTube Data API v3 in Google Cloud Console.
  Connect uses the shared Google OAuth client (`NUXT_GOOGLE_CLIENT_ID` /
  `NUXT_GOOGLE_CLIENT_SECRET` — `NUXT_YOUTUBE_CLIENT_ID` is unused for OAuth).
- **Authorized redirect URI (required, exact match)**: Google rejects the
  login with `Error 400: redirect_uri_mismatch` unless this exact URI is
  registered on that OAuth client (APIs & Services → Credentials → your
  OAuth 2.0 Client → Authorized redirect URIs):
  - Dev: `http://localhost:3000/api/auth/callback/youtube`
  - Prod: `https://<your-domain>/api/auth/callback/youtube`
  (pattern: `NUXT_BETTER_AUTH_URL` + `/api/auth/callback/youtube`).
- **Scopes requested** (single `youtube.force-ssl` bundle — it supersedes
  `youtube`/`youtube.upload`/`youtube.readonly`, which Google rejects when
  combined): `openid email profile` +
  `https://www.googleapis.com/auth/youtube.force-ssl`, with
  `access_type=offline`, `prompt=consent`, `include_granted_scopes=true`.
- **Roles / prerequisites**: the Google account must own (or manage, for
  Brand Accounts) at least one YouTube channel — accounts without a channel
  complete OAuth but create no connection. For production, the OAuth consent
  screen must be published; `youtube.force-ssl` is a sensitive scope, so
  Google verification is required before external users can connect.

### Google (login, Drive, Business)
Same redirect-URI rule as YouTube — all Google-family providers share the
`NUXT_GOOGLE_CLIENT_ID` OAuth client, so register one URI per provider ID
on that single client:
- `http://localhost:3000/api/auth/callback/google` (login)
- `http://localhost:3000/api/auth/callback/google-drive`
- `http://localhost:3000/api/auth/callback/googlemybusiness`
- plus the `https://<your-domain>/...` equivalents for production.
