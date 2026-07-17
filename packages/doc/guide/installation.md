# Installation

## Prerequisites

Before you begin, make sure you have:
- **Node.js** 18+ (recommended: 20+)
- **pnpm** 8+ (or npm/yarn if preferred)
- **Git** for cloning the repository

## Quick Setup

### 1. Clone the Repository

```bash
git clone https://github.com/leamsigc/magicsync.git
cd magicsync
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

```bash
cp .env-example .env
```

Edit `.env` with your configuration. Required variables:
- `DATABASE_URL` - Turso database URL
- `DATABASE_AUTH_TOKEN` - Turso auth token
- Social media API keys (see [Platform Keys](/guide/platform-keys))

### 4. Initialize the Database

```bash
cd packages/db
pnpm db:generate
pnpm db:migrate
```

### 5. Start the Development Server

```bash
pnpm site:dev
```

The application will be available at `http://localhost:3000`

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers |
| `pnpm site:dev` | Start main site (port 3000) |
| `pnpm build` | Build all packages |
| `pnpm site:build` | Build main site |

## Layer Development

Run individual layer packages:

```bash
# Database layer
cd packages/db && pnpm dev

# UI layer
cd packages/ui && pnpm dev

# Any other layer
cd packages/[layer-name] && pnpm dev
```

## Docker Support

For containerized deployment:

```bash
docker-compose up -d
```

See [Docker Setup](/guide/docker-setup) for detailed configuration.

## Self-Hosting & Coolify

Want to run MagicSync on your own server? You have two great options:

- 🏰 [Self-Hosting Guide](/guide/self-hosting) — Build and run MagicSync on your own server using Docker Compose.
- ☁️ [Coolify Deploy Guide](/guide/coolify-deploy) — Deploy with one click using the pre-built Docker image `ghcr.io/leamsigc/magicsync`.

## Troubleshooting

### Port Already in Use

```bash
# Find and kill the process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 pnpm site:dev
```

### Database Connection Issues

1. Verify `DATABASE_URL` in `.env`
2. For Turso, verify your auth token
3. Run migrations: `cd packages/db && pnpm db:migrate`

### Dependencies Issues

```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

For more help, see [Development Setup](/contributing/development-setup) or [FAQ](/guide/faq).