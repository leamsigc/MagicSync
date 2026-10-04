#!/usr/bin/env bash
# doctor.sh — read-only "is this instance worth driving?" check for MagicSync.
#
# Writes nothing, starts nothing, stops nothing, and mutates no data.
# Exit 0 = instance is worth driving. Exit 1 = at least one check failed.
#
# Usage:
#   .cursor/skills/verify-magicsync/scripts/doctor.sh                 # check the default instance
#   VERIFY_BASE_URL=http://localhost:3100 .../doctor.sh              # check a side instance
#   VERIFY_OWNER_FILE=/tmp/x.pid .../doctor.sh                       # instance started by this run
#
set -uo pipefail

BASE_URL="${VERIFY_BASE_URL:-http://localhost:3000}"
OWNER_FILE="${VERIFY_OWNER_FILE:-}"
# scripts -> verify-magicsync -> skills -> .cursor -> repo root
REPO_ROOT="${VERIFY_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"

pass=0
fail=0

ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; pass=$((pass + 1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fail=$((fail + 1)); }
info() { printf '  ....  %s\n' "$1"; }

# A freshly (re)started dev server compiles routes on demand, so the first
# request to an unvisited path can take tens of seconds. Retry before calling
# the instance unhealthy, otherwise doctor reports a cold server as broken.
probe() {
  local url="$1" code="" i
  for i in 1 2 3 4 5; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$url" 2>/dev/null)"
    [ -n "$code" ] && [ "$code" != "000" ] && break
    sleep 5
  done
  printf '%s' "${code:-000}"
}

echo "MagicSync doctor — $BASE_URL"
echo "repo: $REPO_ROOT"
echo

# ---------------------------------------------------------------- 1. HTTP up
echo "[1] HTTP surface"
root_code="$(probe "$BASE_URL/")"
if [ "$root_code" = "200" ]; then
  ok "GET / -> 200"
else
  bad "GET / -> ${root_code:-no-response} (server not ready or not running)"
fi

# ---------------------------------------------------------------- 2. port owner
echo
echo "[2] Port ownership"
port="${BASE_URL##*:}"
port="${port%%/*}"
listeners="$(ss -ltnp 2>/dev/null | grep -E "[:.]${port}[[:space:]]" || true)"
if [ -z "$listeners" ]; then
  bad "nothing is listening on port ${port}"
  server_pid=""
else
  server_pid="$(printf '%s' "$listeners" | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)"
  ok "port ${port} listening (pid ${server_pid:-unknown})"
  if [ -n "$server_pid" ] && [ -r "/proc/${server_pid}/cmdline" ]; then
    cmd="$(tr '\0' ' ' < "/proc/${server_pid}/cmdline")"
    case "$cmd" in
      *nuxt*) ok "pid ${server_pid} is a nuxt process" ;;
      *)      bad "pid ${server_pid} is NOT nuxt — something else owns the port" ;;
    esac
    cwd="$(readlink -f "/proc/${server_pid}/cwd" 2>/dev/null || echo unknown)"
    case "$cwd" in
      "$REPO_ROOT"*) ok "pid ${server_pid} cwd is this checkout ($cwd)" ;;
      *)             bad "pid ${server_pid} cwd is $cwd, not this checkout" ;;
    esac
  fi
fi

# ------------------------------------------------- 3. did this run start it?
echo
echo "[3] Lifecycle ownership (is it safe to drive?)"
if [ -z "$OWNER_FILE" ]; then
  info "no VERIFY_OWNER_FILE — this instance was NOT started by the current run."
  info "Treat it as a SHARED instance: create throwaway fixtures, never delete user data."
else
  if [ -f "$OWNER_FILE" ]; then
    ok "owner file present (pid $(cat "$OWNER_FILE")) — this run owns the instance"
  else
    bad "VERIFY_OWNER_FILE set but missing ($OWNER_FILE)"
  fi
fi

# ---------------------------------------------------------------- 4. database
echo
echo "[4] Database (libsql)"
db_url="$(grep -E '^NUXT_TURSO_DATABASE_URL=' "$REPO_ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2-)"
db_host_port="${db_url#*//}"
db_host_port="${db_host_port%%/*}"
db_port="${db_host_port##*:}"
if [ -z "$db_url" ]; then
  bad "NUXT_TURSO_DATABASE_URL not found in .env"
elif curl -s --max-time 5 "http://localhost:${db_port}/health" >/dev/null 2>&1 \
     || ss -ltn 2>/dev/null | grep -qE "[:.]${db_port}[[:space:]]"; then
  ok "database reachable at ${db_url}"
else
  bad "database not reachable at ${db_url} — start it: docker compose up -d db"
fi

# ------------------------------------------- 5. auth + tenancy wiring (read)
echo
echo "[5] Auth and tenancy wiring (unauthenticated probes)"
session_code="$(probe "$BASE_URL/api/auth/get-session")"
case "$session_code" in
  200|401) ok "GET /api/auth/get-session -> ${session_code} (auth handler mounted)" ;;
  404)     bad "GET /api/auth/get-session -> 404 (auth layer not mounted — wrong port?)" ;;
  *)       bad "GET /api/auth/get-session -> ${session_code:-no-response}" ;;
esac

biz_code="$(probe "$BASE_URL/api/v1/business")"
if [ "$biz_code" = "401" ] || [ "$biz_code" = "403" ]; then
  ok "GET /api/v1/business -> ${biz_code} (session guard active, DB query reached)"
elif [ "$biz_code" = "200" ]; then
  bad "GET /api/v1/business -> 200 with no cookie (auth guard is NOT enforcing)"
else
  bad "GET /api/v1/business -> ${biz_code:-no-response}"
fi

# ------------------------------------------------------- 6. auth redirect
echo
echo "[6] Route guard"
login_code="$(probe "$BASE_URL/app/posts")"
case "$login_code" in
  302|303|307) ok "GET /app/posts -> ${login_code} (redirects unauthenticated users to /login)" ;;
  200)         bad "GET /app/posts -> 200 for an anonymous caller (guard not applying)" ;;
  *)           bad "GET /app/posts -> ${login_code:-no-response}" ;;
esac

# ------------------------------------------------------------ 7. harness
echo
echo "[7] Harness"
if [ -x "$REPO_ROOT/packages/site/node_modules/.bin/playwright" ]; then
  ok "playwright binary present"
else
  bad "playwright binary missing — run: pnpm install"
fi
if ls "$HOME"/.cache/ms-playwright/chromium-* >/dev/null 2>&1; then
  ok "chromium browser installed"
else
  bad "chromium missing — run: pnpm --filter @local-monorepo/site exec playwright install chromium"
fi

# ------------------------------------------------------------ 8. revision
echo
echo "[8] Build under test"
rev="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null)"
dirty="$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
echo "  revision: ${rev:-unknown} (${dirty} uncommitted change(s))"
[ "${dirty:-0}" -gt 0 ] && info "dev server may be serving a mix of committed and local code"

# ------------------------------------------------------------ summary
echo
if [ "$fail" -eq 0 ]; then
  printf '\033[32mDOCTOR PASS\033[0m (%d checks) — instance is worth driving.\n' "$pass"
  exit 0
fi
printf '\033[31mDOCTOR FAIL\033[0m (%d passed, %d failed) — do not trust results from this instance.\n' "$pass" "$fail"
exit 1