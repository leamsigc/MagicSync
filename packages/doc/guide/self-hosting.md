# Self-Hosting MagicSync

Self-hosting MagicSync gives you full control over your data and infrastructure. Instead of using a managed cloud service, you run MagicSync on your own server or computer.

**Why self-host?**
- **Data ownership** — Your data stays on your infrastructure.
- **Customization** — Modify the code and configuration to fit your needs.
- **Cost control** — Pay only for the server resources you use.
- **Privacy** — No third-party access to your content or accounts.

---

## Prerequisites

Before you start, make sure you have:

| Tool | Purpose | Download |
|------|---------|----------|
| Docker | Container runtime | [docker.com](https://www.docker.com/) |
| Docker Compose | Multi-container orchestration | Included with Docker Desktop |
| Git | Clone the repository | [git-scm.com](https://git-scm.com/) |
| Computer or Server | Host for the application | Local machine or VPS |

### Minimum System Requirements

- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB
- **OS**: Linux, macOS, or Windows with Docker

### Recommended for Production

- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD
- **OS**: Ubuntu 22.04 LTS or similar

---

## Architecture Overview

MagicSync self-hosting runs three services together:

```
┌─────────────────────────────────────────┐
│           MagicSync Stack               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │  Site   │  │ Python  │  │   DB    │ │
│  │ (Nuxt)  │  │ Backend │  │ (libSQL)│ │
│  │ :3000   │  │ :8000   │  │ :8080   │ │
│  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────────┘
```

- **Site** — The Nuxt frontend that users interact with.
- **Python Backend** — Handles AI, audio, and video processing.
- **Database** — libSQL server for data persistence.

---

## Quick Start

### Step 1: Clone the Repository

```bash
git clone https://github.com/leamsigc/magicsync.git
cd magicsync
```

### Step 2: Configure Environment Variables

Copy the example environment file and fill in the required values:

```bash
cp .env-example .env
```

Open `.env` in your editor and set the following required values:

```bash
# ============================================================
# DATABASE (Turso / libsql)
# ============================================================
# Option A: Docker local database (recommended for self-hosting)
JWT=<your-jwt-key>                    # Generate: openssl rand -hex 32
SQLD_AUTH_JWT_KEY=<your-sql-key>      # Generate: openssl rand -hex 32
NUXT_TURSO_DATABASE_URL=http://db:8080
NUXT_TURSO_AUTH_TOKEN=<same-as-JWT>

# Option B: Turso cloud
# NUXT_TURSO_DATABASE_URL=<turso-database-url>
# NUXT_TURSO_AUTH_TOKEN=<turso-auth-token>

# ============================================================
# APP CONFIGURATION
# ============================================================
NUXT_HOST=0.0.0.0
NUXT_APP_URL=https://your-domain.com
NUXT_BASE_URL=https://your-domain.com
NUXT_SESSION_PASSWORD=<generate-openssl-rand-hex-32>

# ============================================================
# BETTER AUTH
# ============================================================
# NUXT_BETTER_AUTH_SECRET and BETTER_AUTH_SECRET must be the same value.
NUXT_BETTER_AUTH_URL=https://your-domain.com
NUXT_BETTER_AUTH_SECRET=<generate-openssl-rand-hex-32>
BETTER_AUTH_URL=https://your-domain.com
BETTER_AUTH_SECRET=<same-as-NUXT_BETTER_AUTH_SECRET>

# ============================================================
# PYTHON BACKEND
# ============================================================
NUXT_PYTHON_API_URL=http://python-backend:8000

# ============================================================
# LLM SERVICE (must match Python backend!)
# ============================================================
NUXT_LLM_JWT_SECRET=<generate-openssl-rand-hex-32>

# ============================================================
# FILE STORAGE
# ============================================================
NUXT_FILE_STORAGE_MOUNT=./upload/files
```

#### Generate Secret Keys

Run the following commands to generate secure random values:

```bash
openssl rand -hex 32  # JWT
openssl rand -hex 32  # SQLD_AUTH_JWT_KEY
openssl rand -hex 32  # NUXT_SESSION_PASSWORD
openssl rand -hex 32  # NUXT_BETTER_AUTH_SECRET
openssl rand -hex 32  # BETTER_AUTH_SECRET
openssl rand -hex 32  # NUXT_LLM_JWT_SECRET
```

**Important:** `NUXT_BETTER_AUTH_SECRET` and `BETTER_AUTH_SECRET` must be the same value. The Python backend uses `BETTER_AUTH_SECRET` to validate authentication tokens from the Nuxt app.

### Step 3: Start the Application

Run the following command to start all services in the background:

```bash
docker compose up -d
```

> **Legacy Docker Compose:** If your system still uses the older `docker-compose` command, replace `docker compose` with `docker-compose` in the examples above.

This will:
1. Build the Nuxt site container
2. Build the Python backend container
3. Start the libSQL database container
4. Connect all services on the same Docker network

### Step 4: Access the Application

Once the containers are running, open your browser and visit:

```
http://localhost:3000
```

Or, if you configured a domain:

```
https://your-domain.com
```

![MagicSync Home](/img/home-light.png)

---

## Setting Up Social Media Keys

To connect social media accounts, you need OAuth credentials from each platform. These are required for MagicSync to publish on your behalf.

See the [Platform Keys Guide](/guide/platform-keys) for platform-specific setup instructions.

### Supported Platforms

| Platform | Required Credentials |
|----------|---------------------|
| Facebook | App ID + App Secret + Config ID |
| Instagram | Same as Facebook |
| X/Twitter | Client ID + Client Secret |
| LinkedIn | Client ID + Client Secret |
| TikTok | Client ID + Client Secret |
| YouTube | Client ID + Client Secret |
| Discord | Client ID + Client Secret |
| GitHub | Client ID + Client Secret |

**Note:** Each platform requires a callback URL. Use your public domain, e.g., `https://your-domain.com`.

---

## Development vs Production

### Development Mode

For local testing and development:

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Production Mode

For production, you have two options:

#### Option A: Build from Source (Default)

```bash
docker compose up -d
```

This builds the site from the repository source.

#### Option B: Use the Pre-Built Image

For faster deployments, use the published Docker image instead of building from source:

```yaml
services:
  site:
    image: ghcr.io/leamsigc/magicsync:v1.0.0  # Replace with the latest release tag
    depends_on:
      - db
      - python-backend
    environment:
      - NUXT_HOST=0.0.0.0
      - NUXT_PYTHON_API_URL=http://python-backend:8000
```

**Tip:** Replace `v1.0.0` with the actual tag you want to deploy. Check the [GitHub releases page](https://github.com/leamsigc/magicsync/releases) for available tags. Pinning to a specific tag makes deployments reproducible and avoids unexpected updates from `latest`.

---

## Updating MagicSync

To update to the latest version:

```bash
# Pull the latest code
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build
```

> **Note:** If you are using the older `docker-compose` command, replace `docker compose` with `docker-compose` in the commands above.

---

## Security Best Practices

1. **Keep secrets private** — Never commit your `.env` file.
2. **Use strong secrets** — Generate long, random values for all tokens and passwords.
3. **Update regularly** — Pull the latest updates for security patches.
4. **Back up your database** — Regular backups protect against data loss.
5. **Use HTTPS** — Always use `https://` in production.

### Backing Up the Database

```bash
# Create a backup folder
mkdir -p backups

# Copy the database files
cp -r sqld backups/sqld-$(date +%Y%m%d)
```

---

## Common Commands

```bash
# Stop all services
docker compose down

# Stop and remove all data (use with caution)
docker compose down -v

# List running containers
docker ps

# View site logs
docker compose logs -f site

# View database logs
docker compose logs -f db

# Restart a specific service
docker compose restart site
```

---

## Troubleshooting

### Cannot access localhost:3000

1. Wait for the containers to finish building (this can take 5–10 minutes).
2. Run `docker ps` and verify that `site`, `python-backend`, and `db` are running.
3. Check the site logs: `docker compose logs site`

### Database connection failed

1. Verify that `JWT` matches `NUXT_TURSO_AUTH_TOKEN`.
2. Verify that `SQLD_AUTH_JWT_KEY` is set.
3. Check the database logs: `docker compose logs db`

### Cannot log in

1. Verify that `NUXT_BETTER_AUTH_SECRET` is set.
2. Verify that `NUXT_SESSION_PASSWORD` is set.
3. Make sure you are using `https://` in production.

### Images or videos not uploading

1. Verify that `NUXT_FILE_STORAGE_MOUNT` is set correctly.
2. Make sure the upload directory exists: `mkdir -p upload/files`

### Using Local AI with Ollama

The Python backend can use Ollama for local AI. Add an Ollama service to your `docker-compose.yml`:

```yaml
ollama:
  image: ollama/ollama:latest
  volumes:
    - ollama-data:/root/.ollama
  ports:
    - "11434:11434"
```

Then set `OLLAMA_BASE_URL=http://ollama:11434` for the Python backend.

Alternatively, use a cloud LLM provider by setting `NUXT_OPENAI_API_KEY` in your `.env`.

---

## Next Steps

- [Docker Setup Guide](/guide/docker-setup) — Learn more about Docker configuration
- [Coolify Deployment Guide](/guide/coolify-deploy) — Deploy with Coolify
- [Platform Keys Guide](/guide/platform-keys) — Connect social media accounts
- [AI Tools Guide](/guide/tools) — Explore the built-in tools
