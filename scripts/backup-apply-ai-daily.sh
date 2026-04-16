#!/bin/zsh
set -euo pipefail

BACKUP_ROOT="$HOME/RecoveredCode/Apply-AI-Backups"
LATEST_DIR="$BACKUP_ROOT/latest"
DAILY_DIR="$BACKUP_ROOT/daily"
LOG_DIR="$BACKUP_ROOT/logs"
DAY_STAMP="$(date +%Y-%m-%d)"
OUT_ZIP="$DAILY_DIR/apply-ai-daily-$DAY_STAMP.zip"

mkdir -p "$DAILY_DIR" "$LOG_DIR"

if [[ -x "$HOME/RecoveredCode/Princ/scripts/backup-apply-ai.sh" ]]; then
  "$HOME/RecoveredCode/Princ/scripts/backup-apply-ai.sh"
fi

if [[ ! -d "$LATEST_DIR" ]]; then
  echo "[$(date '+%F %T')] daily backup skipped: latest mirror missing" >> "$LOG_DIR/daily-backup.log"
  exit 1
fi

rm -f "$OUT_ZIP"
(
  cd "$LATEST_DIR"
  ditto -c -k --sequesterRsrc --keepParent . "$OUT_ZIP"
)

ls -1t "$DAILY_DIR"/apply-ai-daily-*.zip 2>/dev/null | tail -n +31 | xargs -r rm -f

echo "[$(date '+%F %T')] daily backup complete: $OUT_ZIP" >> "$LOG_DIR/daily-backup.log"
