#!/usr/bin/env bash
# berth runs this in a new Cal.com worktree: its own database, .env and
# dependencies. Safe to run again; each step skips or redoes cheaply.
set -euo pipefail
exec python3 "${BERTH_KIT_DIR:?run this from berth}/scripts/cal_kit.py" setup
