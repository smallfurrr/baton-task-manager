#!/usr/bin/env bash
# End-to-end check of a running stack (`docker compose up`), through the client's nginx proxy.
# Usage: scripts/smoke-test.sh [base-url]   (default http://localhost:8080)
# Needs curl and jq. It creates two tasks titled "smoke-test ..." and leaves them in place.
set -euo pipefail

BASE="${1:-http://localhost:8080}"
API="$BASE/api"

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "ok: $*"; }

# Send a request and print "<http status>\n<body>".
call() {
  local method="$1" url="$2" data="${3:-}"
  if [ -n "$data" ]; then
    curl -sS -X "$method" "$url" -H 'content-type: application/json' -d "$data" -w '\n%{http_code}'
  else
    curl -sS -X "$method" "$url" -w '\n%{http_code}'
  fi
}
status_of() { tail -n 1 <<<"$1"; }
body_of() { sed '$d' <<<"$1"; }

# The server runs migrations and the seed before it listens, so give it time.
echo "waiting for $API ..."
for _ in $(seq 1 90); do
  curl -fsS "$API/developers" >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS "$API/developers" >/dev/null || fail "the API did not become ready"

# Seed data
developers=$(curl -fsS "$API/developers")
names=$(jq -r 'map(.name) | join(",")' <<<"$developers")
[ "$names" = "Alice,Bob,Carol,Dave" ] || fail "unexpected developers: $names"
pass "seeded developers: $names"

skills=$(curl -fsS "$API/skills")
[ "$(jq -r 'map(.name) | join(",")' <<<"$skills")" = "Backend,Frontend" ] || fail "unexpected skills: $skills"
backend=$(jq -r '.[] | select(.name == "Backend") | .id' <<<"$skills")
alice=$(jq -r '.[] | select(.name == "Alice") | .id' <<<"$developers")
pass "seeded skills: Backend, Frontend"

# The client is served, and /api reaches the server through it
curl -fsS "$BASE/" | grep -q 'id="root"' || fail "the client page was not served"
pass "client served"

# Create a task with a subtask (skills given, so no LLM call is needed)
created=$(call POST "$API/tasks" "{\"title\":\"smoke-test root\",\"skillIds\":[$backend],\"subtasks\":[{\"title\":\"smoke-test child\",\"skillIds\":[$backend]}]}")
[ "$(status_of "$created")" = "201" ] || fail "create returned $(status_of "$created"): $(body_of "$created")"
root=$(body_of "$created" | jq -r '.id')
[ "$(body_of "$created" | jq -r '.subtasks | length')" = "1" ] || fail "the subtask was not created"
pass "created a task with a subtask"

# Done rule: blocked while a subtask is open
blocked=$(call PATCH "$API/tasks/$root" '{"status":"done"}')
[ "$(status_of "$blocked")" = "409" ] || fail "Done was not blocked: $(status_of "$blocked")"
[ "$(body_of "$blocked" | jq -r '.error.code')" = "INCOMPLETE_SUBTASKS" ] || fail "wrong error: $(body_of "$blocked")"
pass "Done is blocked while a subtask is open"

# Skill rule: Alice has Frontend only, the task needs Backend
mismatch=$(call PATCH "$API/tasks/$root" "{\"assigneeId\":$alice}")
[ "$(status_of "$mismatch")" = "409" ] || fail "assignment was not rejected: $(status_of "$mismatch")"
[ "$(body_of "$mismatch" | jq -r '.error.code')" = "SKILL_MISMATCH" ] || fail "wrong error: $(body_of "$mismatch")"
pass "a developer without the required skill cannot be assigned"

echo "All smoke checks passed."
