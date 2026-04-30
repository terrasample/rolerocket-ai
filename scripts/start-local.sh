#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

TARGET_URL="http://localhost:5001/institution-cohort-manager.html"
if [[ "${1:-}" == "--cohort" ]]; then
  TARGET_URL="http://localhost:5001/institution-cohort-manager.html"
fi

if lsof -nP -iTCP:5001 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "RoleRocket local server is already running on http://localhost:5001"
  echo "Open: ${TARGET_URL}"
  exit 0
fi

if lsof -nP -iTCP:5000 -sTCP:LISTEN | grep -q "ControlCe"; then
  echo "Notice: port 5000 is owned by macOS Control Center on this machine."
  echo "Use http://localhost:5001 for RoleRocket pages."
fi

echo "Starting RoleRocket on http://localhost:5001"
echo "Cohort Manager: http://localhost:5001/institution-cohort-manager.html"

env PORT=5001 node backend/server.js
