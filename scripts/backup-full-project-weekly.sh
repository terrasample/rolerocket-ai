#!/bin/zsh
set -euo pipefail

SRC_ROOT="$HOME/RecoveredCode/Princ"
OUT_ROOT="$HOME/RecoveredCode/Full-Project-Backups"
LOG_DIR="$OUT_ROOT/logs"
STAMP="$(date +%Y-%m-%d)"
OUT_ZIP="$OUT_ROOT/rolerocket-full-$STAMP.zip"

mkdir -p "$OUT_ROOT" "$LOG_DIR"

# Exclude heavy/generated/sensitive directories.
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

rsync -a \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'backend/node_modules' \
  --exclude '.env' \
  --exclude 'backend/.env' \
  --exclude '*.log' \
  --exclude 'Apply-AI-Backups' \
  "$SRC_ROOT/" "$TMP_DIR/Princ/"

rm -f "$OUT_ZIP"
(
  cd "$TMP_DIR"
  ditto -c -k --sequesterRsrc --keepParent Princ "$OUT_ZIP"
)

# Keep only latest 12 weekly backups.
ls -1t "$OUT_ROOT"/rolerocket-full-*.zip 2>/dev/null | tail -n +13 | xargs -r rm -f

echo "[$(date '+%F %T')] weekly full backup complete: $OUT_ZIP" >> "$LOG_DIR/weekly-backup.log"
