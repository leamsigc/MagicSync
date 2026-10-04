#!/usr/bin/env bash
# cleanup.sh — tear down what a verification run created, and nothing else.
#
# Hard rules this script enforces:
#   * Never kills by process name. Only stops a server recorded in VERIFY_OWNER_FILE.
#   * Never deletes anything under the evidence directory.
#   * Never touches a database unless you pass --purge-fixtures, and then only
#     rows carrying the exact e2e-*@test.magicsync.dev fixture marker.
#
# Usage:
#   .cursor/skills/verify-magicsync/scripts/cleanup.sh                      # scratch files only
#   .cursor/skills/verify-magicsync/scripts/cleanup.sh --purge-fixtures    # also drop e2e users
#   VERIFY_OWNER_FILE=/tmp/run.pid .../cleanup.sh                          # stop a server we started
#
set -uo pipefail

PURGE=0
[ "${1:-}" = "--purge-fixtures" ] && PURGE=1

OWNER_FILE="${VERIFY_OWNER_FILE:-}"
# scripts -> verify-magicsync -> skills -> .cursor -> repo root
REPO_ROOT="${VERIFY_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
SKILL_DIR="$REPO_ROOT/.cursor/skills/verify-magicsync"
E2E_DIR="$REPO_ROOT/packages/site/tests/e2e"

echo "MagicSync verification cleanup"
echo "repo: $REPO_ROOT"
echo

# ------------------------------------------------------ 1. scratch spec files
echo "[1] Scratch specs"
removed=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  rm -f "$f"
  echo "  removed $(basename "$f")"
  removed=$((removed + 1))
done < <(find "$E2E_DIR" -maxdepth 1 -name 'verify-*.spec.ts' -o -maxdepth 1 -name 'zz-*.spec.ts' 2>/dev/null)
[ "$removed" -eq 0 ] && echo "  none"
echo

# ------------------------------------------------------------ 2. owned server
echo "[2] Instance we started"
if [ -z "$OWNER_FILE" ]; then
  echo "  no VERIFY_OWNER_FILE — this run started no server."
  echo "  Leaving the adopted instance alone (it is not ours to stop)."
else
  if [ -f "$OWNER_FILE" ]; then
    pid="$(cat "$OWNER_FILE")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      for _ in 1 2 3 4 5 6 7 8 9 10; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.5
      done
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
      echo "  stopped pid $pid (recorded in $OWNER_FILE)"
    else
      echo "  pid $pid is already gone"
    fi
    rm -f "$OWNER_FILE"
  else
    echo "  owner file $OWNER_FILE missing — nothing to stop"
  fi
fi
echo

# ------------------------------------------------- 3. throwaway DB fixtures
echo "[3] Database fixtures"
if [ "$PURGE" -eq 0 ]; then
  echo "  skipped. Pass --purge-fixtures for a dry run, or --purge-fixtures --yes to delete."
else
  node "$SKILL_DIR/scripts/purge-fixtures.mjs" "$REPO_ROOT" "${@:2}"
fi
echo

# -------------------------------------------------------------- 4. evidence
echo "[4] Evidence (preserved)"
if [ -d "$SKILL_DIR/evidence" ]; then
  count="$(find "$SKILL_DIR/evidence" -type f 2>/dev/null | wc -l | tr -d ' ')"
  echo "  $count file(s) kept in .cursor/skills/verify-magicsync/evidence/"
  find "$SKILL_DIR/evidence" -type f 2>/dev/null | sed "s|$REPO_ROOT/|  |" | head -40
else
  echo "  no evidence directory yet"
fi
echo

echo "Done. Proof artifacts intentionally survive cleanup."