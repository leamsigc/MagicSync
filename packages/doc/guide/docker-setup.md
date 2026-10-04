# Docker Setup

MagicSync runs as a single Nuxt container plus a libSQL database. There is no separate backend service — chat, agents, the content board, RAG, and media tooling all run inside the site container. A small Python sidecar is available **optionally** for Python-only tools.

## Prerequisites

- Docker (Engine 24+) with the Compose plugin (`docker compose`)
- `openssl` to generate secrets

---

## Self-Hosting (Pre-built Image)

The fastest way to run MagicSync on your own server.

1. **Create a directory for MagicSync**

   ```bash
   mkdir magicsync && cd magicsync
   ```

2. **Create `docker-compose.yml`**

   ```yaml
   services:
     site:
       image: ghcr.io/leamsigc/magicsync:latest
       restart: unless-stopped
       depends_on:
         - db
       env_file:
         - .env
       environment:
         - NUXT_HOST=0.0.0.0
       ports:
         - "3000:3000"

     db:
       image: ghcr.io/tursodatabase/libsql-server:latest
       restart: unless-stopped
       platform: linux/amd64
       env_file:
         - .env
       environment:
         - JWT=${JWT}
         - SQLD_AUTH_JWT_KEY=${SQLD_AUTH_JWT_KEY}
       volumes:
         - ./sqld:/var/lib/sqld
       ports:
         - "8080:8080"
   ```

3. **Create a `.env` file**

   ```bash
   # libSQL database (JWT and NUXT_TURSO_AUTH_TOKEN must match)
   JWT=$(openssl rand -hex 32)
   SQLD_AUTH_JWT_KEY=$(openssl rand -hex 32)
   NUXT_TURSO_DATABASE_URL=http://db:8080
   NUXT_TURSO_AUTH_TOKEN=$JWT

   # Better Auth
   NUXT_BETTER_AUTH_URL=https://your-domain.com
   NUXT_BETTER_AUTH_SECRET=$(openssl rand -hex 32)
   BETTER_AUTH_SECRET=$NUXT_BETTER_AUTH_SECRET
   NUXT_SESSION_PASSWORD=$(openssl rand -hex 32)

   # Credential envelopes + machine routes
   NUXT_PUBLISH_SECRET=$(openssl rand -hex 32)
   MACHINE_BRIDGE_SECRET=$(openssl rand -hex 32)

   # Optional: deployment-wide provider / tool fallbacks
   # OPENAI_API_KEY=...
   # SGAI_API_KEY=...            # ScrapeGraphAI default scraper
   # PYTHON_TOOLS_TOKEN=...      # only if you run the python-tools sidecar
   ```

4. **Start MagicSync**

   ```bash
   docker compose up -d
   ```

5. **Access the application**

   - Open `http://localhost:3000`
   - Create your first account (the first user becomes the admin)

---

## Build From Source

The repository ships a `docker-compose.yml` that builds the site image locally and includes the optional Python sidecar behind a Compose profile.

```bash
git clone https://github.com/leamsigc/production-example-nuxt-monorepo.git
cd production-example-nuxt-monorepo
cp .env-example .env   # then fill in the values
docker compose up -d --build
```

Optional Python tools sidecar (Python-only tools such as ScrapeGraphAI's Python library):

```bash
docker compose --profile tools up -d --build
# then set PYTHON_TOOLS_URL=http://python-tools:8100 in .env
# (users can also point at it from AI settings → Tool backends)
```

### What the image contains

- Nuxt server output plus the musl `@libsql` binding.
- `ffmpeg` and the pinned `yt-dlp` binary (`YTDLP_PATH=/usr/local/bin/yt-dlp`) for the agent's `download_video` tool and the video-cropper's `GET /api/v1/media/video-download` ingest endpoint.
- Supertonic-3 TTS ONNX assets (downloaded at build time).
- No Python runtime — the agent runs in-process with the pi SDK. (The pinned `yt-dlp` is a standalone pyinstaller build, so it does not need one either.)

> **Reverse proxy timeout:** `/api/v1/media/video-download` resolves the source
> before it can stream anything, so a request stays open with no response bytes
> while it works. Worst case is `YTDLP_TIMEOUT_MS` (120s default) plus, for the
> few sources that publish no H.264 at all, a `YTDLP_TRANSCODE_TIMEOUT_MS`
> (300s default) ffmpeg re-encode. Coolify's Traefik defaults to a 60s read
> timeout, which would show up as a bare proxy 504 instead of the route's own
> error — raise the read timeout above the total, or lower both values.

> **Why videos are re-encoded:** sources are requested as H.264 + AAC because
> some browsers (Firefox on Linux) cannot decode AV1 through WebCodecs and fail
> later with `The given encoding is not supported`. Sources that publish no
> H.264 at all — some Facebook reels are AV1-only — are re-encoded to H.264/AAC
> server-side, which needs the `libx264` and `aac` encoders in the image. Set
> `YTDLP_BROWSER_SAFE=0` to skip that re-encode.

> **Scratch folder:** downloads are staged in `YTDLP_DOWNLOAD_DIR`
> (default `/tmp/magicsync-video`), which is created on demand. Each download
> gets its own subfolder that is unlinked once the response settles, so nothing
> is retained, but peak use is `YTDLP_MAX_MB` (200MB default) per in-flight
> request. Mount a real volume at that path rather than relying on the
> container's overlay `/tmp`. See `.env-example` → *Video Ingestion*.

---

## Development

For a hot-reload dev container:

```bash
docker compose -f docker-compose.dev.yml up -d
```

The dev image includes bash, curl, ffmpeg, and the pinned yt-dlp binary. For the Python sidecar in dev, run it on the host with `pnpm python-tools:dev` and point AI settings at `http://localhost:8100`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT` / `NUXT_TURSO_AUTH_TOKEN` | Yes | libSQL auth token pair — must be the same value |
| `SQLD_AUTH_JWT_KEY` | Yes | libSQL server signing key |
| `NUXT_TURSO_DATABASE_URL` | Yes | `http://db:8080` in Compose (or `file:./local.db` for dev) |
| `NUXT_BETTER_AUTH_URL` | Yes | Public URL of the site |
| `NUXT_BETTER_AUTH_SECRET` / `BETTER_AUTH_SECRET` | Yes | Auth signing secret — must match |
| `NUXT_SESSION_PASSWORD` | Yes | Session encryption (32+ chars) |
| `NUXT_PUBLISH_SECRET` | Yes | AES-256-GCM key for credential envelopes and tool-backend secrets |
| `MACHINE_BRIDGE_SECRET` | Yes | HMAC secret for GitHub Actions / internal machine routes |
| `OPENAI_API_KEY` / `NUXT_GOOGLE_GENERATIVE_AI_API_KEY` | No | Server-side provider keys (users can override per business) |
| `SGAI_API_KEY` | No | Deployment fallback ScrapeGraphAI key |
| `PYTHON_TOOLS_URL` / `PYTHON_TOOLS_TOKEN` | No | Python tools sidecar (only with the `tools` profile) |
| `AGENT_DEFAULT_PROVIDER` / `AGENT_DEFAULT_MODEL` | No | Fallback model when a user has no effective config |

See [Self-Hosting](/guide/self-hosting) for the full variable reference, including `AGENT_*` limits.

---

## Updating, Backups, Logs

```bash
# Update to the latest image
docker compose pull && docker compose up -d

# Stop / remove containers
docker compose down

# Logs
docker compose logs -f site

# Back up the database files
cp -r sqld backups/sqld-$(date +%Y%m%d)
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `MODEL_NOT_CONFIGURED` in chat | Set a provider/model in Account → AI settings, or set `AGENT_DEFAULT_PROVIDER`/`AGENT_DEFAULT_MODEL` |
| `SCRAPEGRAPH_NOT_CONFIGURED` | Add a ScrapeGraphAI key in AI settings → Tool backends or set `SGAI_API_KEY` |
| `PYTHON_BACKEND_UNREACHABLE` | Start the sidecar (`docker compose --profile tools up -d`) and verify `PYTHON_TOOLS_URL` |
| Database connection failed | Ensure `JWT` equals `NUXT_TURSO_AUTH_TOKEN` and `NUXT_TURSO_DATABASE_URL` is `http://db:8080` |
| Cannot log in | Check `NUXT_BETTER_AUTH_SECRET`, `BETTER_AUTH_SECRET`, and `NUXT_SESSION_PASSWORD` |
| Container unhealthy | Check `docker compose logs site`; first boot runs migrations and can take a moment |

---

## More Deployment Options

- [Self-Hosting](/guide/self-hosting) — full env reference and upgrades
- [Coolify Deploy](/guide/coolify-deploy) — deploy with the pre-built image `ghcr.io/leamsigc/magicsync`
- [Tool Backends](/guide/tool-backends) — ScrapeGraphAI and the Python tools sidecar
