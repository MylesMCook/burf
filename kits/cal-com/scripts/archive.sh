#!/usr/bin/env bash
# berth runs this before it removes a Cal.com worktree (its services are
# already stopped): drop the worktree's database and clear build caches.
set -euo pipefail
exec python3 "${BERTH_KIT_DIR:?run this from berth}/scripts/cal_kit.py" archive
