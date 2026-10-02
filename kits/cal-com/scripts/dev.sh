#!/usr/bin/env bash
# The worktree's Cal.com dev server, on its own port. berth runs it as the
# "web" service, in the worktree, with the worktree's environment; Next.js
# reads the rest from the .env setup wrote.
set -euo pipefail
: "${BERTH_PORT:?run this from berth}"
export PORT="$BERTH_PORT"
export NEXTAUTH_URL_INTERNAL="http://127.0.0.1:$BERTH_PORT/api/auth"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
export FORCE_COLOR=1
exec yarn dev --env-mode=loose -- --port "$BERTH_PORT" --hostname 127.0.0.1
