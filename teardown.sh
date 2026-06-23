#!/usr/bin/env bash
# =============================================================================
#  Taskis — MANUAL self-destruct (OS level)
#
#  DANGER: this irreversibly removes the Taskis deployment from THIS server:
#    - stops & disables the backend systemd unit and the PM2 frontend process
#    - deletes the H2 database file(s) and all uploaded files
#    - removes the deployment directory (code + build artifacts)
#
#  This is deliberately NOT wired to any web endpoint — a running web app must
#  never be able to delete its own services/source on request. Run it yourself,
#  on the box, on purpose:
#
#      ./teardown.sh --yes-destroy
#
#  (The in-app admin "Self-destruct" only wipes DATA in the database + uploads;
#   this script is the full machine-level teardown.)
# =============================================================================
set -euo pipefail

DEPLOY_DIR="${TASKIS_DIR:-/home/plp/taskis}"     # override with TASKIS_DIR=...
BACKEND_UNIT="${TASKIS_UNIT:-taskis}"            # systemd unit name
FRONTEND_PM2="${TASKIS_PM2:-taskis-frontend}"    # pm2 process name

if [[ "${1:-}" != "--yes-destroy" ]]; then
  echo "Refusing to run. This is IRREVERSIBLE."
  echo "Re-run with:  $0 --yes-destroy"
  exit 1
fi

echo "[teardown] stopping services…"
sudo systemctl stop "$BACKEND_UNIT" 2>/dev/null || true
sudo systemctl disable "$BACKEND_UNIT" 2>/dev/null || true
sudo rm -f "/etc/systemd/system/${BACKEND_UNIT}.service" 2>/dev/null || true
sudo systemctl daemon-reload 2>/dev/null || true
pm2 delete "$FRONTEND_PM2" 2>/dev/null || true
pm2 save 2>/dev/null || true

echo "[teardown] wiping data…"
rm -f  "$DEPLOY_DIR"/backend/*.mv.db "$DEPLOY_DIR"/backend/*.trace.db 2>/dev/null || true
rm -rf "$DEPLOY_DIR"/backend/uploads 2>/dev/null || true

echo "[teardown] removing deployment directory $DEPLOY_DIR …"
rm -rf "$DEPLOY_DIR" 2>/dev/null || true

echo "[teardown] done. No trace of Taskis remains on this host."
