# Docker Setup

MagicSync can be easily set up using Docker Compose.

## Prerequisites
- Docker
- Docker Compose

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
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
   docker-compose up -d
   ```

   This will start the database, application, and other necessary services.

4. **Access the application**
   - App: `http://localhost:3000` (or configured port)
   - Documentation: `http://localhost:3001` (if running)

## Services
- **App**: The main Nuxt application.
- **Database**: PostgreSQL/Turso (check `docker-compose.yml`).
- **Redis**: For queue management (if used).
