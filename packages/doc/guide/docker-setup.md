# Docker Setup

MagicSync can be easily set up using Docker Compose.

## Prerequisites
- Docker
- Docker Compose

## Self-Hosting (Pre-built Image)

The fastest way to run MagicSync on your own server.

1. **Create a directory for MagicSync**
   ```bash
   mkdir magicsync && cd magicsync
   ```

2. **Create the docker-compose.yml**
   ```yaml
   services:
     magicsync:
       image: ghcr.io/leamsigc/magicsync:latest
       container_name: magicsync
       restart: unless-stopped
       ports:
         - "8888:8888"
       volumes:
         - magicsync-data:/app/.data
       environment:
         - NUXT_SESSION_SECRET=${NUXT_SESSION_SECRET:-change-me-in-production}
         - DATABASE_URL=sqlite:///app/.data/magicsync.db
         # Uncomment and configure for PostgreSQL
         # - DATABASE_URL=postgresql://magicsync:magicsync@db:5432/magicsync
       healthcheck:
         test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:8888/"]
         interval: 30s
         timeout: 10s
         retries: 3
         start_period: 10s

   volumes:
     magicsync-data:
   ```

3. **Create a .env file**
   ```bash
   NUXT_SESSION_SECRET=$(openssl rand -hex 32)
   ```

4. **Start MagicSync**
   ```bash
   docker compose up -d
   ```

5. **Access MagicSync**
   - Open `http://localhost:8888` in your browser
   - Create your first account (the first user becomes the admin)

### With PostgreSQL

```yaml
services:
  magicsync:
    image: ghcr.io/leamsigc/magicsync:latest
    container_name: magicsync
    restart: unless-stopped
    ports:
      - "8888:8888"
    volumes:
      - magicsync-data:/app/.data
    environment:
      - NUXT_SESSION_SECRET=${NUXT_SESSION_SECRET:-change-me-in-production}
      - DATABASE_URL=postgresql://magicsync:magicsync@db:5432/magicsync
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:8888/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  db:
    image: postgres:16-alpine
    container_name: magicsync-db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=magicsync
      - POSTGRES_USER=magicsync
      - POSTGRES_PASSWORD=magicsync
    volumes:
      - magicsync-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U magicsync"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  magicsync-data:
  magicsync-pgdata:
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NUXT_SESSION_SECRET` | Yes | Random string for session encryption |
| `DATABASE_URL` | Yes | SQLite or PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `OPENAI_API_KEY` | No | OpenAI API key for AI features |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for AI features |
| `GOOGLE_AI_API_KEY` | No | Google AI API key for AI features |

---

## Development (Build from Source)

1. **Clone the repository**
   ```bash
   git clone https://github.com/leamsigc/production-example-nuxt-monorepo.git
   cd production-example-nuxt-monorepo
   ```

2. **Environment Variables**
   Copy `.env-example` to `.env` and fill in the required values.
   ```bash
   cp .env-example .env
   ```

3. **Start the containers**
   Run the following command to start the development environment:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

4. **Access the application**
   - App: `http://localhost:3000`
   - Documentation: `http://localhost:3001` (if running)

---

## More Deployment Options

- [Coolify Deploy Guide](/guide/coolify-deploy) — Deploy MagicSync easily with Coolify using the pre-built Docker image `ghcr.io/leamsigc/magicsync`.
