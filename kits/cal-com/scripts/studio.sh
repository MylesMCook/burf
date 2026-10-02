#!/usr/bin/env bash
# Prisma Studio on the worktree's database, on its second port. Start it from
# the Run menu when you need it; it doesn't start on its own.
set -euo pipefail
: "${BERTH_PORT_1:?run this from berth}"
exec yarn prisma studio --hostname 127.0.0.1 --port "$BERTH_PORT_1" --browser none
