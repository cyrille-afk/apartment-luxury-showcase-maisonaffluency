#!/usr/bin/env bash
# Run the /trade concierge end-to-end tests using a JWT copied from the
# admin dashboard's "E2E Test Token" card (see src/components/admin/E2ETokenCopier.tsx).
#
# Reads the clipboard, exports it as E2E_USER_ACCESS_TOKEN, and shells out
# to `deno test` in a single step. Works on macOS, Linux (X11/Wayland), and WSL.
#
# Usage:
#   1. Click "Copy raw token" on /trade/admin
#   2. In a terminal at repo root:  ./scripts/run-trade-concierge-e2e.sh
#
# Optional args are forwarded to `deno test` (e.g. --filter "Alexander Lamont").
set -euo pipefail

read_clipboard() {
  if command -v pbpaste >/dev/null 2>&1; then
    pbpaste
  elif command -v wl-paste >/dev/null 2>&1; then
    wl-paste --no-newline
  elif command -v xclip >/dev/null 2>&1; then
    xclip -selection clipboard -o
  elif command -v xsel >/dev/null 2>&1; then
    xsel --clipboard --output
  elif command -v powershell.exe >/dev/null 2>&1; then
    # WSL → Windows clipboard
    powershell.exe -NoProfile -Command "Get-Clipboard" | tr -d '\r'
  else
    return 1
  fi
}

if ! command -v deno >/dev/null 2>&1; then
  echo "error: deno is not installed. See https://deno.land" >&2
  exit 1
fi

TOKEN="$(read_clipboard 2>/dev/null || true)"
# Strip any accidental `export E2E_USER_ACCESS_TOKEN="..."` wrapper from the
# "Copy shell export" button — pull out just the JWT.
if [[ "$TOKEN" == export* ]]; then
  TOKEN="$(echo "$TOKEN" | sed -E 's/^export[[:space:]]+E2E_USER_ACCESS_TOKEN=//; s/^"//; s/"$//')"
fi
# Trim whitespace/newlines.
TOKEN="$(echo -n "$TOKEN" | tr -d '\r\n' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"

if [[ -z "$TOKEN" ]]; then
  echo "error: clipboard is empty or unreadable." >&2
  echo "  Click 'Copy raw token' on /trade/admin first, then re-run this script." >&2
  exit 1
fi

# JWTs are three base64url segments separated by dots.
if ! [[ "$TOKEN" =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
  echo "error: clipboard does not look like a JWT (need three dot-separated segments)." >&2
  echo "  Got: ${TOKEN:0:40}..." >&2
  exit 1
fi

# Decode the exp claim so we fail loudly on expired tokens instead of running
# the full suite only to see 401s.
decode_exp() {
  local payload="${TOKEN#*.}"
  payload="${payload%.*}"
  # pad to multiple of 4 for base64
  local pad=$(( (4 - ${#payload} % 4) % 4 ))
  printf '%s' "$payload" | tr '_-' '/+' | { cat; printf '%*s' "$pad" '' | tr ' ' '='; } \
    | base64 -d 2>/dev/null \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("exp",0))' 2>/dev/null \
    || echo 0
}
EXP="$(decode_exp)"
NOW="$(date +%s)"
if [[ "$EXP" -gt 0 ]] && [[ "$EXP" -le "$NOW" ]]; then
  echo "error: token expired $((NOW - EXP))s ago. Re-copy from /trade/admin." >&2
  exit 1
fi
if [[ "$EXP" -gt 0 ]]; then
  echo "→ token valid for $(( (EXP - NOW) / 60 ))m $(( (EXP - NOW) % 60 ))s"
fi

export E2E_USER_ACCESS_TOKEN="$TOKEN"

echo "→ running trade-concierge end-to-end tests"
exec deno test \
  --allow-net --allow-env --allow-read \
  supabase/functions/trade-concierge/index.test.ts \
  "$@"
