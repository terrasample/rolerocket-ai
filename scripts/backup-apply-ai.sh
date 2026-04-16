#!/bin/zsh
set -euo pipefail

SRC_ROOT="$HOME/RecoveredCode/Princ"
BACKUP_ROOT="$HOME/RecoveredCode/Apply-AI-Backups"
LATEST_DIR="$BACKUP_ROOT/latest"
SNAPSHOT_DIR="$BACKUP_ROOT/snapshots"
LOG_DIR="$BACKUP_ROOT/logs"
STAMP="$(date +%Y%m%d-%H%M%S)"
SNAPSHOT_ZIP="$SNAPSHOT_DIR/apply-ai-$STAMP.zip"

mkdir -p "$LATEST_DIR" "$SNAPSHOT_DIR" "$LOG_DIR"

files=(
  "server.js"
  "package.json"
  "package-lock.json"
  "backend/server.js"
  "backend/package.json"
  "backend/package-lock.json"
  "backend/models"
  "backend/routes"
  "backend/middleware"
  "backend/services"
  "backend/pdfWordUtils.js"
  "backend/ocrUtils.js"
  "frontend/styles.css"
  "frontend/ai-application-tracker.html"
  "frontend/one-click-apply-queue.html"
  "frontend/ai-interview-assist.html"
  "frontend/js/ai-application-tracker.js"
  "frontend/js/one-click-apply-queue.js"
  "frontend/js/ai-interview-assist.js"
  "frontend/js/ai-interview-audio.js"
  "frontend/js/api-base.js"
  "frontend/js/auth-storage.js"
  "frontend/js/dashboard.js"
  "frontend/js/jspdf-loader.js"
)

rm -rf "$LATEST_DIR"
mkdir -p "$LATEST_DIR"
for rel in "${files[@]}"; do
  src="$SRC_ROOT/$rel"
  if [[ -e "$src" ]]; then
    if [[ -d "$src" ]]; then
      mkdir -p "$LATEST_DIR/$(dirname "$rel")"
      rsync -a --delete "$src/" "$LATEST_DIR/$rel/"
    else
      mkdir -p "$LATEST_DIR/$(dirname "$rel")"
      cp -f "$src" "$LATEST_DIR/$rel"
    fi
  fi
done

(
  cd "$LATEST_DIR"
  ditto -c -k --sequesterRsrc --keepParent . "$SNAPSHOT_ZIP"
)

ls -1t "$SNAPSHOT_DIR"/apply-ai-*.zip 2>/dev/null | tail -n +73 | xargs -r rm -f

ICLOUD_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Apply-AI-Backups"
if [[ -d "$HOME/Library/Mobile Documents/com~apple~CloudDocs" ]]; then
  mkdir -p "$ICLOUD_DIR"
  cp -f "$SNAPSHOT_ZIP" "$ICLOUD_DIR/"
  ls -1t "$ICLOUD_DIR"/apply-ai-*.zip 2>/dev/null | tail -n +73 | xargs -r rm -f
fi

echo "[$(date '+%F %T')] backup complete: $SNAPSHOT_ZIP" >> "$LOG_DIR/backup.log"
