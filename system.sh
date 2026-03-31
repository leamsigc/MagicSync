#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[system]${NC} $*"; }
ok()    { echo -e "${GREEN}[system]${NC} $*"; }
warn()  { echo -e "${YELLOW}[system]${NC} $*"; }
err()   { echo -e "${RED}[system]${NC} $*" >&2; }

cleanup() {
    info "Shutting down..."
    jobs -p | xargs -r kill 2>/dev/null || true
    wait 2>/dev/null || true
    ok "All processes stopped."
}
trap cleanup EXIT INT TERM

check_deps() {
    local missing=()
    for cmd in pnpm uv; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
        err "Missing dependencies: ${missing[*]}"
        exit 1
    fi
}

check_docker_deps() {
    if ! command -v docker &>/dev/null; then
        err "docker is not installed"
        exit 1
    fi
    if ! docker compose version &>/dev/null; then
        err "docker compose plugin is not available"
        exit 1
    fi
}

generate_secrets() {
    info "Generating secrets..."
    local jwt sql_key session_key auth_secret

    jwt=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p)
    sql_key=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p)
    session_key=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p)
    auth_secret=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p)

    if [[ -f "$SCRIPT_DIR/.env" ]]; then
        sed -i "s|^JWT=.*|JWT=$jwt|" "$SCRIPT_DIR/.env"
        sed -i "s|^SQLD_AUTH_JWT_KEY=.*|SQLD_AUTH_JWT_KEY=$sql_key|" "$SCRIPT_DIR/.env"
        sed -i "s|^NUXT_SESSION_PASSWORD=<generate-openssl-rand-hex-32>|NUXT_SESSION_PASSWORD=$session_key|" "$SCRIPT_DIR/.env"
        sed -i "s|^NUXT_BETTER_AUTH_SECRET=<generate-openssl-rand-hex-32>|NUXT_BETTER_AUTH_SECRET=$auth_secret|" "$SCRIPT_DIR/.env"
        sed -i "s|^BETTER_AUTH_SECRET=<generate-openssl-rand-hex-32>|BETTER_AUTH_SECRET=$auth_secret|" "$SCRIPT_DIR/.env"
        ok "Secrets generated in .env"
    fi
}

ensure_env() {
    if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
        warn ".env not found — copying from .env-example"
        cp "$SCRIPT_DIR/.env-example" "$SCRIPT_DIR/.env"
    fi
    if [[ ! -f "$SCRIPT_DIR/packages/python-backend/.env" ]]; then
        if [[ -f "$SCRIPT_DIR/packages/python-backend/.env.example" ]]; then
            cp "$SCRIPT_DIR/packages/python-backend/.env.example" "$SCRIPT_DIR/packages/python-backend/.env"
        fi
    fi
}

cmd_dev() {
    check_deps
    ensure_env
    info "Starting local development (site + python-backend)..."

    cmd_site &
    cmd_python &

    ok "Site:        http://localhost:3000"
    ok "Python API:  http://localhost:8000"
    ok "API docs:    http://localhost:8000/docs"
    echo ""
    info "Press Ctrl+C to stop everything."

    wait
}

cmd_site() {
    check_deps
    ensure_env
    info "Starting Nuxt site on port 3000..."
    pnpm site:dev
}

cmd_python() {
    check_deps
    ensure_env
    info "Starting Python backend on port 8000..."
    cd "$SCRIPT_DIR/packages/python-backend"
    if [[ -d venv ]]; then
        source venv/bin/activate
        uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env
    else
        uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env
    fi
}

cmd_dev_docker() {
    check_docker_deps
    ensure_env
    info "Starting Docker development (site + python-backend + db)..."

    docker compose -f "$SCRIPT_DIR/docker-compose.yml" up --build
}

cmd_dev_docker_detached() {
    check_docker_deps
    ensure_env
    info "Starting Docker development in background..."

    docker compose -f "$SCRIPT_DIR/docker-compose.yml" up --build -d

    ok "Containers running:"
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps
}

cmd_stop() {
    info "Stopping Docker containers..."
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" down
    ok "Containers stopped."
}

cmd_stop_local() {
    info "Stopping local development processes..."
    pkill -f "pnpm site:dev" 2>/dev/null || true
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    ok "Local processes stopped."
}

cmd_db_migrate() {
    ensure_env
    info "Running database migrations..."
    pnpm packages @local-monorepo/db db:migrate
    ok "Migrations complete."
}

cmd_db_studio() {
    ensure_env
    info "Opening Drizzle Studio..."
    pnpm packages @local-monorepo/db db:studio
}

cmd_setup() {
    info "Setting up environment files..."
    ensure_env
    generate_secrets

    if [[ -f "$SCRIPT_DIR/packages/python-backend/.env" ]]; then
        sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=["http://localhost:3000"]|' "$SCRIPT_DIR/packages/python-backend/.env"
    fi

    if [[ -f "$SCRIPT_DIR/.env" ]]; then
        sed -i 's|^NUXT_PYTHON_API_URL=.*|NUXT_PYTHON_API_URL=http://localhost:8000|' "$SCRIPT_DIR/.env"
    fi

    ok "Setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Edit .env with your API keys (social logins, email, AI services)"
    echo "  2. Run ./system.sh dev to start local development"
    echo "  3. Or run ./system.sh dev:docker for full Docker stack"
}

cmd_help() {
    echo -e "${CYAN}MagicSync System${NC} — spin up the full stack"
    echo ""
    echo -e "${GREEN}Usage:${NC}"
    echo "  ./system.sh <command> [options]"
    echo ""
    echo -e "${GREEN}Commands:${NC}"
    echo -e "  ${YELLOW}setup${NC}                  Generate .env files and secrets (run first!)"
    echo -e "  ${YELLOW}dev${NC}                    Start site + python-backend locally (hot reload)"
    echo -e "  ${YELLOW}dev:site${NC}               Start only Nuxt site locally (port 3000)"
    echo -e "  ${YELLOW}dev:python${NC}             Start only Python backend locally (port 8000)"
    echo -e "  ${YELLOW}dev:docker${NC}             Start all services in Docker (site + python + db)"
    echo -e "  ${YELLOW}dev:docker:bg${NC}         Start Docker in detached mode (background)"
    echo -e "  ${YELLOW}stop${NC}                   Stop Docker containers"
    echo -e "  ${YELLOW}stop:local${NC}             Stop local dev processes"
    echo -e "  ${YELLOW}db:migrate${NC}             Run database migrations"
    echo -e "  ${YELLOW}db:studio${NC}              Open Drizzle Studio"
    echo -e "  ${YELLOW}help${NC}                   Show this help"
    echo ""
    echo -e "${GREEN}Quick Start:${NC}"
    echo -e "  1. ${YELLOW}./system.sh setup${NC}           Generate .env files + secrets"
    echo -e "  2. ${YELLOW}./system.sh dev${NC}              Start local dev (site + python)"
    echo -e "  3. Or run separate: ${YELLOW}./system.sh dev:site${NC} or ${YELLOW}./system.sh dev:python${NC}"
    echo "  4. Open http://localhost:3000"
    echo ""
    echo -e "${GREEN}Docker Quick Start:${NC}"
    echo -e "  1. ${YELLOW}./system.sh setup${NC}           Generate .env files + secrets"
    echo -e "  2. ${YELLOW}./system.sh dev:docker:bg${NC}    Start all services in Docker"
    echo "  3. Open http://localhost:3000"
    echo ""
    echo -e "${GREEN}Ports:${NC}"
    echo "  Site:        http://localhost:3000"
    echo "  Python API:  http://localhost:8000  (local dev only)"
    echo "  DB (sqld):   http://localhost:8080  (docker only)"
}

case "${1:-help}" in
    setup)           cmd_setup ;;
    dev)             cmd_dev ;;
    dev:site)        cmd_site ;;
    dev:python)      cmd_python ;;
    dev:docker)      cmd_dev_docker ;;
    dev:docker:bg)   cmd_dev_docker_detached ;;
    stop)            cmd_stop ;;
    stop:local)      cmd_stop_local ;;
    db:migrate)     cmd_db_migrate ;;
    db:studio)      cmd_db_studio ;;
    help|--help|-h) cmd_help ;;
    *)
        err "Unknown command: $1"
        echo ""
        cmd_help
        exit 1
        ;;
esac